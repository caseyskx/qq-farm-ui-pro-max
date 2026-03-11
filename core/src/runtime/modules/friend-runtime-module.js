const { startFriendCheckLoop, resetFriendRuntimeState } = require('../../services/friend');
const { RuntimeModuleBase } = require('../runtime-module-base');

function toNum(value) {
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : 0;
}

class FriendRuntimeModule extends RuntimeModuleBase {
    constructor(context = {}) {
        super('friend', context);
    }

    onStart() {
        startFriendCheckLoop({ externalScheduler: true });
        this.onRuntime('friend:list_updated', this.handleFriendListUpdated);
    }

    onStop() {
        resetFriendRuntimeState();
    }

    handleFriendListUpdated(friendsData) {
        const getUserState = this.context && this.context.getUserState;
        const sendToMaster = this.context && this.context.sendToMaster;
        if (typeof getUserState !== 'function' || typeof sendToMaster !== 'function') {
            return;
        }

        const userState = getUserState() || {};
        const resolveFriendIdentifier = (friend) => {
            const openId = String(friend && friend.open_id || '').trim();
            if (openId) return openId;
            const uin = String(friend && friend.uin || '').trim();
            if (uin) return uin;
            const gid = toNum(friend && friend.gid);
            return gid > 0 ? String(gid) : '';
        };

        const list = (Array.isArray(friendsData) ? friendsData : [])
            .filter((friend) => toNum(friend && friend.gid) !== toNum(userState.gid) && friend && friend.name !== '小小农夫' && friend.remark !== '小小农夫')
            .map(friend => ({
                gid: toNum(friend && friend.gid),
                uin: resolveFriendIdentifier(friend),
                name: friend && (friend.remark || friend.name) ? (friend.remark || friend.name) : `GID:${toNum(friend && friend.gid)}`,
                avatarUrl: String(friend && friend.avatar_url || '').trim(),
            }))
            .filter(friend => friend.gid > 0);

        if (list.length > 0) {
            sendToMaster({ type: 'sync_friends_cache', data: list });
        }
    }
}

function createFriendRuntimeModule(context = {}) {
    return new FriendRuntimeModule(context);
}

module.exports = {
    FriendRuntimeModule,
    createFriendRuntimeModule,
};
