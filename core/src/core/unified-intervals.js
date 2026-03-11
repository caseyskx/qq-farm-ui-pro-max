const DEFAULT_UNIFIED_INTERVALS = Object.freeze({
    farm: { legacy: 30, min: 30, max: 120 },
    friend: { legacy: 60, min: 60, max: 180 },
    help: { min: 60, max: 180 },
    steal: { min: 60, max: 180 },
});

function normalizeIntervalRangeSec(minSec, maxSec, fallbackSec) {
    const fallback = Math.max(1, Number.parseInt(fallbackSec, 10) || 1);
    let min = Math.max(1, Number.parseInt(minSec, 10) || fallback);
    let max = Math.max(1, Number.parseInt(maxSec, 10) || fallback);
    if (min > max) [min, max] = [max, min];
    return { min, max };
}

function isSameRange(left, right) {
    return Number(left && left.min) === Number(right && right.min)
        && Number(left && left.max) === Number(right && right.max);
}

function resolveFriendSubRange(rawMin, rawMax, fallbackRange, defaultSubRange, defaultFriendRange) {
    const minSeed = rawMin !== undefined && rawMin !== null && rawMin !== ''
        ? rawMin
        : fallbackRange.min;
    const maxSeed = rawMax !== undefined && rawMax !== null && rawMax !== ''
        ? rawMax
        : fallbackRange.max;
    const resolved = normalizeIntervalRangeSec(minSeed, maxSeed, fallbackRange.min);
    if (!isSameRange(fallbackRange, defaultFriendRange) && isSameRange(resolved, defaultSubRange)) {
        return { ...fallbackRange };
    }
    return resolved;
}

function resolveRuntimeIntervals(intervals) {
    const data = (intervals && typeof intervals === 'object') ? intervals : {};

    const farmLegacy = Math.max(1, Number.parseInt(data.farm, 10) || DEFAULT_UNIFIED_INTERVALS.farm.legacy);
    const farmRange = normalizeIntervalRangeSec(data.farmMin, data.farmMax, farmLegacy);

    const friendLegacy = Math.max(1, Number.parseInt(data.friend, 10) || DEFAULT_UNIFIED_INTERVALS.friend.legacy);
    const friendRange = normalizeIntervalRangeSec(data.friendMin, data.friendMax, friendLegacy);

    const defaultFriendRange = normalizeIntervalRangeSec(
        DEFAULT_UNIFIED_INTERVALS.friend.min,
        DEFAULT_UNIFIED_INTERVALS.friend.max,
        DEFAULT_UNIFIED_INTERVALS.friend.legacy,
    );
    const defaultHelpRange = normalizeIntervalRangeSec(
        DEFAULT_UNIFIED_INTERVALS.help.min,
        DEFAULT_UNIFIED_INTERVALS.help.max,
        defaultFriendRange.min,
    );
    const defaultStealRange = normalizeIntervalRangeSec(
        DEFAULT_UNIFIED_INTERVALS.steal.min,
        DEFAULT_UNIFIED_INTERVALS.steal.max,
        defaultFriendRange.min,
    );

    const helpRange = resolveFriendSubRange(
        data.helpMin,
        data.helpMax,
        friendRange,
        defaultHelpRange,
        defaultFriendRange,
    );
    const stealRange = resolveFriendSubRange(
        data.stealMin,
        data.stealMax,
        friendRange,
        defaultStealRange,
        defaultFriendRange,
    );

    return {
        farm: farmRange,
        friend: friendRange,
        help: helpRange,
        steal: stealRange,
    };
}

function computeNextRunAt(startedAtMs, delayMs) {
    const startedAt = Math.max(0, Number(startedAtMs) || 0);
    const delay = Math.max(1000, Number(delayMs) || 1000);
    return startedAt + delay;
}

module.exports = {
    DEFAULT_UNIFIED_INTERVALS,
    computeNextRunAt,
    normalizeIntervalRangeSec,
    resolveRuntimeIntervals,
};
