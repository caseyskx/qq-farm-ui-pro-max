
const { CONFIG, PlantPhase, PHASE_NAMES } = require('../../config/config');
const { getPlantName, getPlantById, getSeedImageBySeedId } = require('../../config/gameConfig');
const { isAutomationOn, getFriendQuietHours, getFriendBlacklist, setFriendBlacklist, getStealFilterConfig, getStealFriendFilterConfig, getStakeoutStealConfig, getConfigSnapshot, getForceGetAllConfig } = require('../../models/store');
const { sendMsgAsync, sendMsgAsyncUrgent, getUserState, networkEvents } = require('../../utils/network');
const { types } = require('../../utils/proto');
const { toLong, toNum, toTimeSec, getServerTimeSec, log, logWarn, sleep } = require('../../utils/utils');
const { getCurrentPhase, setOperationLimitsCallback } = require('../farm');
const { recordOperation } = require('../stats');
const { sellAllFruits } = require('../warehouse');
const { getPool } = require('../mysql-db');
const PlatformFactory = require('../../platform/PlatformFactory');
const state = require('./friend-state');
const scanner = require('./friend-scanner');
const decision = require('./friend-decision');
const BANNED_ERROR_CODE = 1002003;
const FRIEND_FETCH_MODE = {
    UNKNOWN: 'unknown',
    SYNC_ALL: 'sync_all',
    GET_ALL: 'get_all',
};
const FRIEND_FETCH_RESULT_LOG_TTL_MS = 5 * 60 * 1000;
const _friendFetchStateByAccount = new Map();


async function getAllFriends() {
    let reply;
    const platformInst = PlatformFactory.createPlatform(CONFIG.platform);
    const userState = getUserState();
    const accountId = userState?.accountId || null;
    let fetchState = _getFriendFetchState(_getFriendFetchKey(accountId));
    const forceGetAll = getForceGetAllConfig(accountId).enabled;
    const isWeChat = !platformInst.allowSyncAll();
    const label = isWeChat ? '微信' : 'QQ';

    if (!forceGetAll && fetchState.modeSource === 'forced') {
        resetGetAllMode(accountId);
        fetchState = _getFriendFetchState(_getFriendFetchKey(accountId));
    }

    if (forceGetAll) {
        _setFriendFetchMode(fetchState, FRIEND_FETCH_MODE.GET_ALL, `已启用强制兼容模式，固定使用 GetAll (${label})`, 'forced');
        reply = await _getAllViaGetAll('强制强效兼容模式', { fetchState, retryOnEmpty: false });
    } else if (fetchState.mode === FRIEND_FETCH_MODE.GET_ALL) {
        reply = await _getAllViaGetAll(`${label}已锁定`, { fetchState, retryOnEmpty: false });
        if (!_hasUsableFriendEntries(reply, userState)) {
            resetGetAllMode(accountId);
            logWarn('好友', `已锁定 GetAll 模式，但本次返回${_describeFriendReply(reply, userState)}(${label})；已清空模式缓存，下次重新探测`);
        }
    } else if (fetchState.mode === FRIEND_FETCH_MODE.SYNC_ALL) {
        reply = await _getAllViaSyncAll(isWeChat, { fetchState });
        if (!_hasUsableFriendEntries(reply, userState)) {
            log('好友', `已锁定 SyncAll 模式，但本次返回${_describeFriendReply(reply, userState)}(${label})，改用 GetAll 复核`);
            reply = await _getAllViaGetAll(`${label}兼容复核`, { fetchState, retryOnEmpty: true });
            if (_hasUsableFriendEntries(reply, userState)) {
                _setFriendFetchMode(fetchState, FRIEND_FETCH_MODE.GET_ALL, `${label} 环境已确认使用 GetAll 更稳定`);
            } else {
                resetGetAllMode(accountId);
            }
        }
    } else {
        reply = await _getAllViaSyncAll(isWeChat, { fetchState });
        if (_hasUsableFriendEntries(reply, userState)) {
            _setFriendFetchMode(fetchState, FRIEND_FETCH_MODE.SYNC_ALL, `${label} 环境首轮探测通过，后续固定使用 SyncAll`);
        } else {
            log('好友', `首次探测：SyncAll 返回${_describeFriendReply(reply, userState)}(${label})，改用 GetAll 复核`);
            reply = await _getAllViaGetAll(`${label}兼容探测`, { fetchState, retryOnEmpty: true });
            if (_hasUsableFriendEntries(reply, userState)) {
                _setFriendFetchMode(fetchState, FRIEND_FETCH_MODE.GET_ALL, `${label} 环境首轮探测确认需使用 GetAll`);
            }
        }
    }

    if (reply && reply.game_friends && networkEvents) {
        networkEvents.emit('friends_updated', reply.game_friends);
    }

    return reply;
}

function resetGetAllMode(accountId = null) {
    if (accountId !== null && accountId !== undefined) {
        _friendFetchStateByAccount.delete(_getFriendFetchKey(accountId));
        return;
    }
    _friendFetchStateByAccount.clear();
}

function isGetAllMode() {
    const userState = getUserState();
    const accountId = userState?.accountId || null;
    const fetchState = _friendFetchStateByAccount.get(_getFriendFetchKey(accountId));
    return fetchState?.mode === FRIEND_FETCH_MODE.GET_ALL;
}

function _isSelfOnly(friends, userState) {
    if (!friends || friends.length !== 1 || !userState) return false;
    const selfGid = toNum(userState.gid);
    return selfGid > 0 && toNum(friends[0].gid) === selfGid;
}

function _getFriendFetchState(accountId) {
    if (!_friendFetchStateByAccount.has(accountId)) {
        _friendFetchStateByAccount.set(accountId, {
            mode: FRIEND_FETCH_MODE.UNKNOWN,
            lastResultKey: '',
            lastResultAt: 0,
            modeReason: '',
            modeSource: 'probe',
        });
    }
    return _friendFetchStateByAccount.get(accountId);
}

function _getFriendFetchKey(accountId) {
    return accountId || '__default__';
}

function _setFriendFetchMode(fetchState, mode, reason, source = 'probe') {
    const changed = fetchState.mode !== mode || fetchState.modeReason !== reason || fetchState.modeSource !== source;
    fetchState.mode = mode;
    fetchState.modeReason = reason;
    fetchState.modeSource = source;
    if (!changed) return;
    const modeLabel = mode === FRIEND_FETCH_MODE.GET_ALL ? 'GetAll' : 'SyncAll';
    log('好友', `好友拉取模式已锁定为 ${modeLabel}：${reason}`);
}

function _hasUsableFriendEntries(reply, userState) {
    const friends = Array.isArray(reply?.game_friends) ? reply.game_friends : [];
    if (friends.length === 0) return false;
    return !(friends.length === 1 && _isSelfOnly(friends, userState));
}

function _describeFriendReply(reply, userState) {
    const friends = Array.isArray(reply?.game_friends) ? reply.game_friends : [];
    if (friends.length === 0) return '空';
    if (friends.length === 1 && _isSelfOnly(friends, userState)) return '仅自己';
    return `${friends.length} 个好友`;
}

function _logFriendFetchResult(methodName, modeName, reply, fetchState) {
    const friendCount = reply?.game_friends ? reply.game_friends.length : 0;
    const invCount = reply?.invitations ? reply.invitations.length : 0;
    const appCount = toNum(reply?.application_count);
    const summaryKey = `${methodName}:${modeName}:${friendCount}:${invCount}:${appCount}`;
    const now = Date.now();

    if (fetchState && fetchState.lastResultKey === summaryKey && (now - fetchState.lastResultAt) < FRIEND_FETCH_RESULT_LOG_TTL_MS) {
        return;
    }

    if (fetchState) {
        fetchState.lastResultKey = summaryKey;
        fetchState.lastResultAt = now;
    }

    log('好友', `${methodName} 结果(${modeName}): game_friends=${friendCount}, invitations=${invCount}, application_count=${appCount}`);
}

async function _getAllViaSyncAll(isWeChat, options = {}) {
    const label = isWeChat ? '微信' : 'QQ';
    const fetchState = options.fetchState || null;
    try {
        const requestObj = types.SyncAllFriendsRequest.create({ open_ids: [] });
        const body = types.SyncAllFriendsRequest.encode(requestObj).finish();
        const { body: replyBody } = await sendMsgAsync('gamepb.friendpb.FriendService', 'SyncAll', body);
        const reply = types.SyncAllFriendsReply.decode(replyBody);
        _logFriendFetchResult('SyncAll', label, reply, fetchState);
        return reply;
    } catch (syncErr) {
        const errMsg = syncErr.message || '';
        if (errMsg.includes('code=1000020')) {
            log('好友', `SyncAll 返回 code=1000020(${label})，该接口不支持当前账号`);
        } else {
            logWarn('好友', `SyncAll 失败(${label}): ${errMsg}`);
        }
        return { game_friends: [], invitations: [], application_count: 0 };
    }
}

async function _getAllViaGetAll(modeName, options = {}) {
    let reply;
    const fetchState = options.fetchState || null;
    const retryOnEmpty = options.retryOnEmpty !== false;
    const maxRetries = retryOnEmpty ? 2 : 0;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const body = types.GetAllFriendsRequest.encode(types.GetAllFriendsRequest.create({})).finish();
        const { body: replyBody } = await sendMsgAsync('gamepb.friendpb.FriendService', 'GetAll', body);

        try {
            reply = types.GetAllFriendsReply.decode(replyBody);
            if (attempt === 0 && reply) {
                _logFriendFetchResult('GetAll', modeName, reply, fetchState);
            }
            if (reply && reply.game_friends && reply.game_friends.length > 0) {
                break;
            }
        } catch (decErr) {
            logWarn('好友', `GetAll 反序列化失败: ${decErr.message}`);
        }

        if (attempt < maxRetries) {
            const delay = 3000 + Math.floor(Math.random() * 2000);
            log('好友', `GetAll 返回空，${delay}ms 后重试 (${attempt + 1}/${maxRetries})`);
            await sleep(delay);
        }
    }
    return reply;
}


async function getApplications() {
    const body = types.GetApplicationsRequest.encode(types.GetApplicationsRequest.create({})).finish();
    const { body: replyBody } = await sendMsgAsync('gamepb.friendpb.FriendService', 'GetApplications', body);
    const reply = types.GetApplicationsReply.decode(replyBody);
    const appCount = reply.applications ? reply.applications.length : 0;
    log('好友', `GetApplications 结果: applications=${appCount}, block=${!!reply.block_applications}`);
    if (appCount > 0) {
        reply.applications.forEach((a, i) => {
            log('好友', `  申请[${i}]: gid=${toNum(a.gid)}, name=${a.name || ''}, open_id=${a.open_id || ''}, level=${toNum(a.level)}`);
        });
    }
    return reply;
}


async function acceptFriends(gids) {
    const body = types.AcceptFriendsRequest.encode(types.AcceptFriendsRequest.create({
        friend_gids: gids.map(g => toLong(g)),
    })).finish();
    const { body: replyBody } = await sendMsgAsync('gamepb.friendpb.FriendService', 'AcceptFriends', body);
    return types.AcceptFriendsReply.decode(replyBody);
}


async function enterFriendFarm(friendGid, isUrgent = false) {
    const body = types.VisitEnterRequest.encode(types.VisitEnterRequest.create({
        host_gid: toLong(friendGid),
        reason: 2,  // ENTER_REASON_FRIEND
    })).finish();
    const sendFn = isUrgent ? sendMsgAsyncUrgent : sendMsgAsync;
    const { body: replyBody } = await sendFn('gamepb.visitpb.VisitService', 'Enter', body);
    return types.VisitEnterReply.decode(replyBody);
}


async function leaveFriendFarm(friendGid, isUrgent = false) {
    const body = types.VisitLeaveRequest.encode(types.VisitLeaveRequest.create({
        host_gid: toLong(friendGid),
    })).finish();
    try {
        const sendFn = isUrgent ? sendMsgAsyncUrgent : sendMsgAsync;
        await sendFn('gamepb.visitpb.VisitService', 'Leave', body);
    } catch { /* 离开失败不影响主流程 */ }
}

function updateOperationLimits(limits) {
    if (!limits || limits.length === 0) return;
    scanner.checkDailyReset();
    for (const limit of limits) {
        const id = toNum(limit.id);
        if (id > 0) {
            const data = {
                dayTimes: toNum(limit.day_times),
                dayTimesLimit: toNum(limit.day_times_lt),
                dayExpTimes: toNum(limit.day_exp_times),
                dayExpTimesLimit: toNum(limit.day_ex_times_lt), // 协议字段名为 day_ex_times_lt
            };
            state.operationLimits.set(id, data);
        }
    }
}

function canGetExp(opId) {
    const limit = state.operationLimits.get(opId);
    if (!limit) {
        // 无限制数据：经验限制功能关闭时放行，开启时保守等待数据
        return !isAutomationOn('friend_help_exp_limit');
    }
    if (limit.dayExpTimesLimit <= 0) return true;  // 没有经验上限
    return limit.dayExpTimes < limit.dayExpTimesLimit;
}

function canGetExpByCandidates(opIds = []) {
    const ids = Array.isArray(opIds) ? opIds : [opIds];
    for (const id of ids) {
        if (canGetExp(toNum(id))) return true;
    }
    return false;
}

function canOperate(opId) {
    const limit = state.operationLimits.get(opId);
    if (!limit) return true;
    if (limit.dayTimesLimit <= 0) return true;
    return limit.dayTimes < limit.dayTimesLimit;
}

function getRemainingTimes(opId) {
    const limit = state.operationLimits.get(opId);
    if (!limit || limit.dayTimesLimit <= 0) return 999;
    return Math.max(0, limit.dayTimesLimit - limit.dayTimes);
}

function getOperationLimits() {
    const result = {};
    for (const id of [10001, 10002, 10003, 10004, 10005, 10006, 10007, 10008]) {
        const limit = state.operationLimits.get(id);
        if (limit) {
            result[id] = {
                name: state.OP_NAMES[id] || `#${id}`,
                ...limit,
                remaining: getRemainingTimes(id),
            };
        }
    }
    return result;
}


async function helpWater(friendGid, landIds, stopWhenExpLimit = false) {
    const beforeExp = toNum((getUserState() || {}).exp);
    const body = types.WaterLandRequest.encode(types.WaterLandRequest.create({
        land_ids: landIds,
        host_gid: toLong(friendGid),
    })).finish();
    const { body: replyBody } = await sendMsgAsync('gamepb.plantpb.PlantService', 'WaterLand', body);
    const reply = types.WaterLandReply.decode(replyBody);
    updateOperationLimits(reply.operation_limits);
    if (stopWhenExpLimit) {
        await sleep(200);
        const afterExp = toNum((getUserState() || {}).exp);
        if (afterExp <= beforeExp) scanner.autoDisableHelpByExpLimit();
    }
    return reply;
}


async function helpWeed(friendGid, landIds, stopWhenExpLimit = false) {
    const beforeExp = toNum((getUserState() || {}).exp);
    const body = types.WeedOutRequest.encode(types.WeedOutRequest.create({
        land_ids: landIds,
        host_gid: toLong(friendGid),
    })).finish();
    const { body: replyBody } = await sendMsgAsync('gamepb.plantpb.PlantService', 'WeedOut', body);
    const reply = types.WeedOutReply.decode(replyBody);
    updateOperationLimits(reply.operation_limits);
    if (stopWhenExpLimit) {
        await sleep(200);
        const afterExp = toNum((getUserState() || {}).exp);
        if (afterExp <= beforeExp) scanner.autoDisableHelpByExpLimit();
    }
    return reply;
}


async function helpInsecticide(friendGid, landIds, stopWhenExpLimit = false) {
    const beforeExp = toNum((getUserState() || {}).exp);
    const body = types.InsecticideRequest.encode(types.InsecticideRequest.create({
        land_ids: landIds,
        host_gid: toLong(friendGid),
    })).finish();
    const { body: replyBody } = await sendMsgAsync('gamepb.plantpb.PlantService', 'Insecticide', body);
    const reply = types.InsecticideReply.decode(replyBody);
    updateOperationLimits(reply.operation_limits);
    if (stopWhenExpLimit) {
        await sleep(200);
        const afterExp = toNum((getUserState() || {}).exp);
        if (afterExp <= beforeExp) scanner.autoDisableHelpByExpLimit();
    }
    return reply;
}


async function stealHarvest(friendGid, landIds, isUrgent = false) {
    const body = types.HarvestRequest.encode(types.HarvestRequest.create({
        land_ids: landIds,
        host_gid: toLong(friendGid),
        is_all: true,
    })).finish();
    const sendFn = isUrgent ? sendMsgAsyncUrgent : sendMsgAsync;
    const { body: replyBody } = await sendFn('gamepb.plantpb.PlantService', 'Harvest', body);
    const reply = types.HarvestReply.decode(replyBody);
    updateOperationLimits(reply.operation_limits);
    return reply;
}


async function putPlantItems(friendGid, landIds, RequestType, ReplyType, method) {
    let ok = 0;
    const ids = Array.isArray(landIds) ? landIds : [];
    for (const landId of ids) {
        try {
            const body = RequestType.encode(RequestType.create({
                land_ids: [toLong(landId)],
                host_gid: toLong(friendGid),
            })).finish();
            const { body: replyBody } = await sendMsgAsync('gamepb.plantpb.PlantService', method, body);
            const reply = ReplyType.decode(replyBody);
            updateOperationLimits(reply.operation_limits);
            ok++;
        } catch { /* ignore single failure */ }
        // 令牌桶已在底层做了 334ms 间隔限流，无需额外 sleep
    }
    return ok;
}


async function putPlantItemsDetailed(friendGid, landIds, RequestType, ReplyType, method) {
    let ok = 0;
    const failed = [];
    const ids = Array.isArray(landIds) ? landIds : [];
    for (const landId of ids) {
        try {
            const body = RequestType.encode(RequestType.create({
                land_ids: [toLong(landId)],
                host_gid: toLong(friendGid),
            })).finish();
            const { body: replyBody } = await sendMsgAsync('gamepb.plantpb.PlantService', method, body);
            const reply = ReplyType.decode(replyBody);
            updateOperationLimits(reply.operation_limits);
            ok++;
        } catch (e) {
            failed.push({ landId, reason: e && e.message ? e.message : '未知错误' });
        }
        // 令牌桶已在底层做了 334ms 间隔限流，无需额外 sleep
    }
    return { ok, failed };
}


async function putInsects(friendGid, landIds) {
    return putPlantItems(friendGid, landIds, types.PutInsectsRequest, types.PutInsectsReply, 'PutInsects');
}


async function putWeeds(friendGid, landIds) {
    return putPlantItems(friendGid, landIds, types.PutWeedsRequest, types.PutWeedsReply, 'PutWeeds');
}


async function putInsectsDetailed(friendGid, landIds) {
    return putPlantItemsDetailed(friendGid, landIds, types.PutInsectsRequest, types.PutInsectsReply, 'PutInsects');
}


async function putWeedsDetailed(friendGid, landIds) {
    return putPlantItemsDetailed(friendGid, landIds, types.PutWeedsRequest, types.PutWeedsReply, 'PutWeeds');
}


async function checkCanOperateRemote(friendGid, operationId) {
    if (!types.CheckCanOperateRequest || !types.CheckCanOperateReply) {
        return { canOperate: true, canStealNum: 0 };
    }
    try {
        const body = types.CheckCanOperateRequest.encode(types.CheckCanOperateRequest.create({
            host_gid: toLong(friendGid),
            operation_id: toLong(operationId),
        })).finish();
        const { body: replyBody } = await sendMsgAsync('gamepb.plantpb.PlantService', 'CheckCanOperate', body);
        const reply = types.CheckCanOperateReply.decode(replyBody);
        return {
            canOperate: !!reply.can_operate,
            canStealNum: toNum(reply.can_steal_num),
        };
    } catch {
        // 预检查失败时降级为不拦截，避免因协议抖动导致完全不操作
        return { canOperate: true, canStealNum: 0 };
    }
}

async function doFriendOperation(friendGid, opType) {
    const gid = toNum(friendGid);
    if (!gid) return { ok: false, message: '无效好友ID', opType };

    let enterReply;
    try {
        enterReply = await enterFriendFarm(gid);
    } catch (e) {
        if (e && e.code === BANNED_ERROR_CODE) {
            decision.autoBlacklistBannedFriend(gid, opType === 'steal' ? `GID:${gid}` : `GID:${gid}`);
        }
        return { ok: false, message: `进入好友农场失败: ${e.message}`, opType };
    }

    try {
        const lands = enterReply.lands || [];
        const state = getUserState();
        const status = decision.analyzeFriendLands(lands, state.gid, '');
        let count = 0;

        if (opType === 'steal') {
            if (!status.stealable.length) return { ok: true, opType, count: 0, message: '没有可偷取土地' };
            const precheck = await checkCanOperateRemote(gid, 10008);
            if (!precheck.canOperate) return { ok: true, opType, count: 0, message: '今日偷菜次数已用完' };
            const maxNum = precheck.canStealNum > 0 ? precheck.canStealNum : status.stealable.length;
            const target = status.stealable.slice(0, maxNum);
            count = await scanner.runBatchWithFallback(target, (ids) => stealHarvest(gid, ids), (ids) => stealHarvest(gid, ids));
            if (count > 0) {
                recordOperation('steal', count);
                // 手动偷取成功后立即尝试出售一次果实
                try {
                    await sellAllFruits();
                } catch (e) {
                    logWarn('仓库', `手动偷取后自动出售失败: ${e.message}`, {
                        module: 'warehouse',
                        event: 'sell_after_steal',
                        result: 'error',
                        mode: 'manual',
                    });
                }
            }
            return { ok: true, opType, count, message: `偷取完成 ${count} 块` };
        }

        if (opType === 'water') {
            if (!status.needWater.length) return { ok: true, opType, count: 0, message: '没有可浇水土地' };
            const precheck = await checkCanOperateRemote(gid, 10007);
            if (!precheck.canOperate) return { ok: true, opType, count: 0, message: '今日浇水次数已用完' };
            count = await scanner.runBatchWithFallback(status.needWater, (ids) => helpWater(gid, ids), (ids) => helpWater(gid, ids));
            if (count > 0) recordOperation('helpWater', count);
            return { ok: true, opType, count, message: `浇水完成 ${count} 块` };
        }

        if (opType === 'weed') {
            if (!status.needWeed.length) return { ok: true, opType, count: 0, message: '没有可除草土地' };
            const precheck = await checkCanOperateRemote(gid, 10005);
            if (!precheck.canOperate) return { ok: true, opType, count: 0, message: '今日除草次数已用完' };
            count = await scanner.runBatchWithFallback(status.needWeed, (ids) => helpWeed(gid, ids), (ids) => helpWeed(gid, ids));
            if (count > 0) recordOperation('helpWeed', count);
            return { ok: true, opType, count, message: `除草完成 ${count} 块` };
        }

        if (opType === 'bug') {
            if (!status.needBug.length) return { ok: true, opType, count: 0, message: '没有可除虫土地' };
            const precheck = await checkCanOperateRemote(gid, 10006);
            if (!precheck.canOperate) return { ok: true, opType, count: 0, message: '今日除虫次数已用完' };
            count = await scanner.runBatchWithFallback(status.needBug, (ids) => helpInsecticide(gid, ids), (ids) => helpInsecticide(gid, ids));
            if (count > 0) recordOperation('helpBug', count);
            return { ok: true, opType, count, message: `除虫完成 ${count} 块` };
        }

        if (opType === 'bad') {
            let bugCount = 0;
            let weedCount = 0;
            if (!status.canPutBug.length && !status.canPutWeed.length) {
                return { ok: true, opType, count: 0, bugCount: 0, weedCount: 0, message: '没有可捣乱土地' };
            }

            // 手动捣乱不依赖预检查，逐块执行（与 terminal-farm-main 保持一致）
            let failDetails = [];
            if (status.canPutBug.length) {
                const bugRet = await putInsectsDetailed(gid, status.canPutBug);
                bugCount = bugRet.ok;
                failDetails = failDetails.concat((bugRet.failed || []).map(f => `放虫#${f.landId}:${f.reason}`));
                if (bugCount > 0) recordOperation('bug', bugCount);
            }
            if (status.canPutWeed.length) {
                const weedRet = await putWeedsDetailed(gid, status.canPutWeed);
                weedCount = weedRet.ok;
                failDetails = failDetails.concat((weedRet.failed || []).map(f => `放草#${f.landId}:${f.reason}`));
                if (weedCount > 0) recordOperation('weed', weedCount);
            }
            count = bugCount + weedCount;
            if (count <= 0) {
                const reasonPreview = failDetails.slice(0, 2).join(' | ');
                return {
                    ok: true,
                    opType,
                    count: 0,
                    bugCount,
                    weedCount,
                    message: reasonPreview ? `捣乱失败: ${reasonPreview}` : '捣乱失败或今日次数已用完'
                };
            }
            return { ok: true, opType, count, bugCount, weedCount, message: `捣乱完成 虫${bugCount}/草${weedCount}` };
        }

        return { ok: false, opType, count: 0, message: '未知操作类型' };
    } catch (e) {
        return { ok: false, opType, count: 0, message: e.message || '操作失败' };
    } finally {
        try { await leaveFriendFarm(gid); } catch { /* ignore */ }
    }
}

async function doFriendBatchOperation(friendGids = [], opType, options = {}) {
    const list = Array.from(new Set((Array.isArray(friendGids) ? friendGids : []).map(Number).filter(gid => Number.isFinite(gid) && gid > 0)));
    const continueOnError = options.continueOnError !== false;
    const skipBlacklisted = options.skipBlacklisted !== false;
    const stopOnBan = options.stopOnBan !== false;
    const cooldownMs = Math.max(0, Number(options.cooldownMs || 1200));
    const blacklist = new Set(getFriendBlacklist());
    const results = [];
    let successCount = 0;
    let failCount = 0;
    let totalAffectedCount = 0;

    for (let i = 0; i < list.length; i++) {
        const gid = list[i];
        if (skipBlacklisted && blacklist.has(gid)) {
            results.push({
                gid,
                ok: false,
                skipped: true,
                opType,
                count: 0,
                message: '好友在黑名单中，已跳过',
            });
            continue;
        }

        const result = await doFriendOperation(gid, opType);
        results.push({ gid, ...result });
        if (result && result.ok) {
            successCount += 1;
            totalAffectedCount += Math.max(0, Number(result.count || 0));
        } else {
            failCount += 1;
        }

        const message = String((result && result.message) || '');
        if ((!result || !result.ok) && !continueOnError) break;
        if (stopOnBan && (message.includes('1002003') || message.includes('封禁'))) break;

        if (cooldownMs > 0 && i < list.length - 1) {
            await sleep(cooldownMs + Math.floor(Math.random() * Math.min(600, cooldownMs || 1)));
        }
    }

    return {
        ok: true,
        opType,
        total: list.length,
        successCount,
        failCount,
        totalAffectedCount,
        results,
    };
}

Object.assign(module.exports, { getAllFriends, getApplications, acceptFriends, enterFriendFarm, leaveFriendFarm, updateOperationLimits, canGetExp, canGetExpByCandidates, canOperate, getRemainingTimes, getOperationLimits, helpWater, helpWeed, helpInsecticide, stealHarvest, putPlantItems, putPlantItemsDetailed, putInsects, putWeeds, putInsectsDetailed, putWeedsDetailed, checkCanOperateRemote, doFriendOperation, doFriendBatchOperation, resetGetAllMode, isGetAllMode });
