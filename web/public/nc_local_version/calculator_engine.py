import json
import os
import math

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')

def load_json(name):
    with open(os.path.join(DATA_DIR, name), 'r', encoding='utf-8') as f:
        return json.load(f)

CROPS_DATA = load_json('crops.json')
LANDS_DATA = load_json('lands.json')
EXP_TABLE = load_json('exp_table.json')

# 土地等级加成表
LAND_BONUSES = {
    1: {'yield': 0.0,  'timeReduce': 0.0,  'expBonus': 0.0},
    2: {'yield': 1.0,  'timeReduce': 0.0,  'expBonus': 0.0},
    3: {'yield': 2.0,  'timeReduce': 0.10, 'expBonus': 0.0},
    4: {'yield': 3.0,  'timeReduce': 0.20, 'expBonus': 0.20},
}

# 操作耗时常量
PLANT_SPEED_NO_FERT = 9    # 不施肥种植速度：9块/秒
PLANT_SPEED_FERT = 6       # 施肥时种植速度：6块/秒
FERT_ACTION_PER_LAND = 0.1 # 施肥操作：每块地 0.1秒


def calculate_time_crops():
    return CROPS_DATA


def calculate_lands_for_level(level):
    level_str = str(level)
    return LANDS_DATA.get(level_str, LANDS_DATA.get("1"))


def format_time(seconds):
    """格式化秒数为中文可读字符串"""
    seconds = max(1, round(seconds))
    if seconds < 60:
        return f"{seconds}秒"
    m = seconds // 60
    s = seconds % 60
    if m < 60:
        return f"{m}分{s}秒" if s > 0 else f"{m}分钟"
    h = m // 60
    mm = m % 60
    return f"{h}小时{mm}分" if mm > 0 else f"{h}小时"


def get_crop_stats(crop, params, land_dist, lands, min_land_level, is_smart_fert, is_ideal, is_s2_fert):
    """
    计算单个作物的完整统计数据，匹配前端所有期望字段。
    
    参数:
        crop: 作物数据
        params: 请求参数
        land_dist: 土地分布 {4: n4, 3: n3, 2: n2, 1: n1}
        lands: 总土地数
        min_land_level: 有作物的最低土地等级（木桶效应）
        is_smart_fert: 是否智能施肥（选最长阶段）
        is_ideal: 是否理想模式（不计操作耗时）
        is_s2_fert: 是否二季也用化肥
    """
    # 时间缩减率取最低等级土地（木桶效应）
    time_reduce_pct = LAND_BONUSES[min_land_level]['timeReduce']

    # 获取有效生长阶段（排除成熟阶段 seconds=0）
    phases = crop['phases']
    valid_phases = [p for p in phases if p['seconds'] > 0]
    phase_count = len(valid_phases)

    # 构建阶段详情（供前端验算弹窗）
    phase_details = []
    for p in valid_phases:
        phase_details.append({
            'name': p['name'],
            'seconds': p['seconds'],
            'img': p.get('img', ''),
        })

    # 计算一季生长时间（考虑土地时间缩减）
    phase_secs_adjusted = []
    for p in valid_phases:
        adj = max(1, round(p['seconds'] * (1 - time_reduce_pct)))
        phase_secs_adjusted.append(adj)
    total_grow_sec = sum(phase_secs_adjusted)

    # 判断是否两季作物
    seasons = crop.get('seasons', 1)
    is_two_season = seasons > 1

    # 两季作物：第二季从倒数第2个有效阶段重新生长
    second_season_grow_sec = 0
    full_cycle_grow_sec = total_grow_sec
    two_season_diff = False
    if is_two_season and phase_count >= 2:
        # 第二季走最后2个阶段
        s2_phases = phase_secs_adjusted[-2:]
        second_season_grow_sec = sum(s2_phases)
        full_cycle_grow_sec = total_grow_sec + second_season_grow_sec
        two_season_diff = True

    # 施肥计算
    # 判断各阶段时长是否全部相同
    fert_phases_all_same = len(set(p['seconds'] for p in valid_phases)) == 1 and phase_count > 1

    if is_smart_fert:
        # 智能施肥：选最长阶段
        max_phase_sec = max(phase_secs_adjusted) if phase_secs_adjusted else 0
        max_phase_idx = phase_secs_adjusted.index(max_phase_sec) if phase_secs_adjusted else 0
        fert_best_phase_sec = max_phase_sec
        fert_best_phase_names = [valid_phases[max_phase_idx]['name']]
        fert_best_phase_orders = [max_phase_idx + 1]
    else:
        # 普通施肥：跳过第一阶段
        if phase_secs_adjusted:
            fert_best_phase_sec = phase_secs_adjusted[0]
            fert_best_phase_names = [valid_phases[0]['name']]
            fert_best_phase_orders = [1]
        else:
            fert_best_phase_sec = 0
            fert_best_phase_names = []
            fert_best_phase_orders = []

    # 施肥后一季生长时间
    grow_time_fert = max(1, total_grow_sec - fert_best_phase_sec)

    # 二季施肥计算
    second_season_grow_fert_sec = second_season_grow_sec
    second_season_fert_active = False
    if is_two_season and two_season_diff and is_s2_fert and len(phase_secs_adjusted) >= 2:
        # 二季也用化肥：跳过二季最长阶段
        s2_phases_adj = phase_secs_adjusted[-2:]
        s2_max = max(s2_phases_adj)
        second_season_grow_fert_sec = max(1, second_season_grow_sec - s2_max)
        second_season_fert_active = True

    # 完整周期（施肥后）
    if two_season_diff:
        full_cycle_grow_fert_sec = grow_time_fert + second_season_grow_sec  # 不含二季施肥
        full_cycle_grow_fert_with_s2_sec = grow_time_fert + (second_season_grow_fert_sec if second_season_fert_active else second_season_grow_sec)
    else:
        full_cycle_grow_fert_sec = grow_time_fert
        full_cycle_grow_fert_with_s2_sec = grow_time_fert

    # 经验计算（按土地分布加权）
    base_exp = crop['exp']
    total_exp = 0
    for lv in [4, 3, 2, 1]:
        cnt = land_dist.get(lv, 0)
        if cnt > 0:
            exp_bonus = LAND_BONUSES[lv]['expBonus']
            total_exp += cnt * base_exp * (1 + exp_bonus)
    total_exp = round(total_exp)

    # 两季作物经验翻倍
    exp_per_cycle = total_exp * 2 if two_season_diff else total_exp

    # 金币计算（按土地分布加权产量）
    base_fruit_count = crop.get('fruitCount', 0)
    fruit_sell_price = crop.get('fruitSellPrice', 0)
    total_gold = 0
    effective_fruit_count = 0
    for lv in [4, 3, 2, 1]:
        cnt = land_dist.get(lv, 0)
        if cnt > 0:
            yield_bonus = LAND_BONUSES[lv]['yield']
            fruit_for_this = round(base_fruit_count * (1 + yield_bonus))
            effective_fruit_count += fruit_for_this * cnt
            total_gold += fruit_for_this * fruit_sell_price * cnt
    total_gold = round(total_gold)
    # 有效果实总数 = 全部土地的平均值（用于展示单块地的有效产量）
    if lands > 0:
        effective_fruit_per_land = round(effective_fruit_count / lands)
    else:
        effective_fruit_per_land = base_fruit_count

    # 两季作物金币翻倍
    gold_per_cycle = total_gold * 2 if two_season_diff else total_gold

    # 循环时间计算（含操作耗时）
    plant_sec_no_fert = lands / PLANT_SPEED_NO_FERT
    plant_sec_fert = lands / PLANT_SPEED_FERT
    fert_action_sec = lands * FERT_ACTION_PER_LAND

    if is_ideal:
        # 理想模式：循环时间 = 纯生长时间
        if two_season_diff:
            cycle_no_fert = float(full_cycle_grow_sec)
            cycle_fert = float(full_cycle_grow_fert_with_s2_sec)
        else:
            cycle_no_fert = float(total_grow_sec)
            cycle_fert = float(grow_time_fert)
    else:
        # 实际模式：含操作耗时
        if two_season_diff:
            cycle_no_fert = full_cycle_grow_sec + plant_sec_no_fert  # 种一次
            if second_season_fert_active:
                cycle_fert = full_cycle_grow_fert_with_s2_sec + plant_sec_fert + fert_action_sec * 2
            else:
                cycle_fert = full_cycle_grow_fert_with_s2_sec + plant_sec_fert + fert_action_sec
        else:
            cycle_no_fert = total_grow_sec + plant_sec_no_fert
            cycle_fert = grow_time_fert + plant_sec_fert + fert_action_sec

    # 效率计算
    cycle_no_fert = max(1, cycle_no_fert)
    cycle_fert = max(1, cycle_fert)

    exp_per_hour_no_fert = round(exp_per_cycle / (cycle_no_fert / 3600), 2)
    exp_per_hour_fert = round(exp_per_cycle / (cycle_fert / 3600), 2)
    gold_per_hour_no_fert = round(gold_per_cycle / (cycle_no_fert / 3600), 2)
    gold_per_hour_fert = round(gold_per_cycle / (cycle_fert / 3600), 2)

    # 每日数据
    exp_per_day_no_fert = exp_per_hour_no_fert * 24
    exp_per_day_fert = exp_per_hour_fert * 24
    gold_per_day_no_fert = gold_per_hour_no_fert * 24
    gold_per_day_fert = gold_per_hour_fert * 24

    # 提升比例
    gain_percent = ((exp_per_hour_fert - exp_per_hour_no_fert) / exp_per_hour_no_fert * 100) if exp_per_hour_no_fert > 0 else 0
    gold_gain_percent = ((gold_per_hour_fert - gold_per_hour_no_fert) / gold_per_hour_no_fert * 100) if gold_per_hour_no_fert > 0 else 0

    # 种子图路径
    thumb = ''
    if phases and phases[0].get('img'):
        # 使用第一阶段的图片
        thumb = phases[0]['img']

    return {
        # 基础信息
        "name": crop['name'],
        "seedId": crop['seed_id'],
        "requiredLevel": crop['level'],
        "price": crop.get('price', 0),
        "exp": base_exp,
        "fruitCount": base_fruit_count,
        "fruitSellPrice": fruit_sell_price,
        "effectiveFruitCount": effective_fruit_per_land,
        "thumb": thumb,
        "phaseCount": phase_count,
        "phaseDetails": phase_details,
        "isTwoSeason": is_two_season,
        "twoSeasonDiff": two_season_diff,

        # 一季生长时间
        "growTimeSec": total_grow_sec,
        "growTimeStr": format_time(total_grow_sec),

        # 施肥后一季生长时间
        "growTimeFert": grow_time_fert,
        "growTimeFertStr": format_time(grow_time_fert),

        # 二季数据
        "secondSeasonGrowSec": second_season_grow_sec,
        "secondSeasonGrowStr": format_time(second_season_grow_sec) if second_season_grow_sec > 0 else "",
        "secondSeasonGrowFertSec": second_season_grow_fert_sec,
        "secondSeasonGrowFertStr": format_time(second_season_grow_fert_sec) if second_season_grow_fert_sec > 0 else "",
        "secondSeasonFertActive": second_season_fert_active,

        # 完整周期（两季合计）
        "fullCycleGrowSec": full_cycle_grow_sec,
        "fullCycleGrowStr": format_time(full_cycle_grow_sec),
        "fullCycleGrowFertSec": full_cycle_grow_fert_sec,
        "fullCycleGrowFertStr": format_time(full_cycle_grow_fert_sec),
        "fullCycleGrowFertWithS2Sec": full_cycle_grow_fert_with_s2_sec,
        "fullCycleGrowFertWithS2Str": format_time(full_cycle_grow_fert_with_s2_sec),

        # 循环时间（含操作耗时）
        "cycleNoFert": round(cycle_no_fert, 4),
        "cycleFert": round(cycle_fert, 4),

        # 每轮经验/金币
        "expPerCycle": exp_per_cycle,
        "goldPerCycle": gold_per_cycle,

        # 每小时效率
        "expPerHourNoFert": exp_per_hour_no_fert,
        "expPerHourFert": exp_per_hour_fert,
        "goldPerHourNoFert": gold_per_hour_no_fert,
        "goldPerHourFert": gold_per_hour_fert,

        # 每日数据
        "expPerDayNoFert": exp_per_day_no_fert,
        "expPerDayFert": exp_per_day_fert,
        "goldPerDayNoFert": gold_per_day_no_fert,
        "goldPerDayFert": gold_per_day_fert,

        # 提升比例
        "gainPercent": round(gain_percent, 4),
        "goldGainPercent": round(gold_gain_percent, 4),

        # 施肥相关
        "fertBestPhaseNames": fert_best_phase_names,
        "fertBestPhaseOrders": fert_best_phase_orders,
        "fertBestPhaseSec": fert_best_phase_sec,
        "fertPhasesAllSame": fert_phases_all_same,
    }


def calculate_main(params):
    """主计算接口 /api/calculator"""
    level = int(params.get('level', 1))
    is_smart_fert = int(params.get('smart', 0)) == 1
    is_ideal = int(params.get('ideal', 0)) == 1
    is_s2_fert = int(params.get('s2fert', 0)) == 1

    # 获取土地信息
    lands_info = calculate_lands_for_level(level)
    lands = lands_info['lands']
    default_dist = lands_info.get('distribution', {})

    # 用户手动输入的土地分布
    gold = int(params.get('gold', 0))
    black = int(params.get('black', 0))
    red = int(params.get('red', 0))
    normal = int(params.get('normal', 0))

    # 如果用户有输入，使用用户输入；否则使用默认分布
    if gold + black + red + normal > 0:
        land_dist = {4: gold, 3: black, 2: red, 1: normal}
        # 确保总数等于 lands
        user_total = gold + black + red + normal
        if user_total != lands:
            # 用用户总数而不强制修正，前端已校验
            lands = user_total
    else:
        land_dist = {
            4: int(default_dist.get('4', default_dist.get(4, 0))),
            3: int(default_dist.get('3', default_dist.get(3, 0))),
            2: int(default_dist.get('2', default_dist.get(2, 0))),
            1: int(default_dist.get('1', default_dist.get(1, 0))),
        }

    # 木桶效应：取有作物的最低土地等级
    active_levels = [lv for lv in [1, 2, 3, 4] if land_dist.get(lv, 0) > 0]
    min_land_level = min(active_levels) if active_levels else 1

    # 过滤等级符合的作物
    eligible_crops = [c for c in CROPS_DATA['crops'] if c['level'] <= level]

    # 计算操作耗时（传给前端摘要用）
    plant_sec_no_fert = round(lands / PLANT_SPEED_NO_FERT, 4)
    fert_action_sec = round(lands * FERT_ACTION_PER_LAND, 1)

    results = []
    for c in eligible_crops:
        stats = get_crop_stats(c, params, land_dist, lands, min_land_level,
                               is_smart_fert, is_ideal, is_s2_fert)
        results.append(stats)

    # 排序
    rows_fert = sorted(results, key=lambda x: x['expPerHourFert'], reverse=True)
    rows_no_fert = sorted(results, key=lambda x: x['expPerHourNoFert'], reverse=True)
    rows_gold_fert = sorted(results, key=lambda x: x['goldPerHourFert'], reverse=True)
    rows_gold_no_fert = sorted(results, key=lambda x: x['goldPerHourNoFert'], reverse=True)

    # 最佳推荐
    best_fert = rows_fert[0] if rows_fert else None
    best_no_fert = rows_no_fert[0] if rows_no_fert else None
    best_gold_fert = rows_gold_fert[0] if rows_gold_fert else None
    best_gold_no_fert = rows_gold_no_fert[0] if rows_gold_no_fert else None

    return {
        # 全局元数据
        "level": level,
        "lands": lands,
        "landDist": land_dist,
        "totalCrops": len(eligible_crops),
        "smartFert": is_smart_fert,
        "ideal": is_ideal,
        "secondSeasonFert": is_s2_fert,
        "plantSecNoFert": plant_sec_no_fert,
        "fertActionSec": fert_action_sec,

        # 经验排行
        "rowsFert": rows_fert,
        "rowsNoFert": rows_no_fert,

        # 金币排行
        "rowsGoldFert": rows_gold_fert,
        "rowsGoldNoFert": rows_gold_no_fert,

        # 推荐
        "bestFert": best_fert,
        "bestNoFert": best_no_fert,
        "bestGoldFert": best_gold_fert,
        "bestGoldNoFert": best_gold_no_fert,
    }


def _get_total_exp(lvl):
    """查询指定等级的累计经验"""
    for item in EXP_TABLE:
        if int(item['level']) == int(lvl):
            return int(item['total_exp'])
    return 0


def _get_best_crop_for_level(level, is_smart_fert=True, is_s2_fert=True, use_land_bonus=True):
    """获取指定等级下的最优作物及相关信息"""
    lands_info = calculate_lands_for_level(level)
    lands = lands_info['lands']
    default_dist = lands_info.get('distribution', {})
    land_dist = {
        4: int(default_dist.get('4', default_dist.get(4, 0))),
        3: int(default_dist.get('3', default_dist.get(3, 0))),
        2: int(default_dist.get('2', default_dist.get(2, 0))),
        1: int(default_dist.get('1', default_dist.get(1, 0))),
    }

    if not use_land_bonus:
        # 不用土地加成：所有土地视为普通
        land_dist = {4: 0, 3: 0, 2: 0, 1: lands}

    active_levels = [lv for lv in [1, 2, 3, 4] if land_dist.get(lv, 0) > 0]
    min_land_level = min(active_levels) if active_levels else 1

    eligible_crops = [c for c in CROPS_DATA['crops'] if c['level'] <= level]
    if not eligible_crops:
        return None, lands_info, land_dist, min_land_level

    params = {'level': str(level), 'smart': '1', 's2fert': '1' if is_s2_fert else '0'}

    results = []
    for c in eligible_crops:
        stats = get_crop_stats(c, params, land_dist, lands, min_land_level,
                               is_smart_fert, True, is_s2_fert)
        results.append(stats)

    best = max(results, key=lambda x: x['expPerHourFert'])
    return best, lands_info, land_dist, min_land_level


def _build_segments(cur_level, tgt_level, cur_exp, is_smart_fert=True, is_s2_fert=True, use_land_bonus=True):
    """构建分段种植方案"""
    segments = []
    exp_remaining = _get_total_exp(tgt_level) - _get_total_exp(cur_level) - cur_exp
    if exp_remaining <= 0:
        return segments, 0

    total_exp_needed = exp_remaining

    # 找出等级变化点（最优作物可能变化的等级）
    level_changes = set()
    for c in CROPS_DATA['crops']:
        lv = c['level']
        if cur_level < lv <= tgt_level:
            level_changes.add(lv)
    # 也加入土地解锁变化点
    for lv_str in LANDS_DATA.keys():
        try:
            lv = int(lv_str)
            if cur_level < lv <= tgt_level:
                level_changes.add(lv)
        except ValueError:
            pass

    # 构建等级区间
    breakpoints = sorted(level_changes)
    ranges = []
    start = cur_level
    for bp in breakpoints:
        if bp > start:
            ranges.append((start, bp))
            start = bp
    if start < tgt_level:
        ranges.append((start, tgt_level))
    if not ranges:
        ranges = [(cur_level, tgt_level)]

    exp_accumulated = cur_exp
    for range_start, range_end in ranges:
        if exp_remaining <= 0:
            break

        best, lands_info, land_dist, min_land_level = _get_best_crop_for_level(
            range_start, is_smart_fert, is_s2_fert, use_land_bonus)
        if not best:
            continue

        lands = lands_info['lands']
        exp_per_cycle = best.get('expPerCycle', 0)
        if exp_per_cycle <= 0:
            continue

        # 该区间需要的经验
        range_exp = _get_total_exp(range_end) - _get_total_exp(range_start)
        if range_start == cur_level:
            range_exp -= exp_accumulated
        range_exp = max(0, min(range_exp, exp_remaining))

        if range_exp <= 0:
            continue

        cycles = math.ceil(range_exp / exp_per_cycle)
        actual_exp = exp_per_cycle * cycles

        # 化肥计算
        # 普通化肥：每轮施肥一次（smart模式选最长阶段）
        fert_phase_sec = best.get('fertBestPhaseSec', 0)
        is_two_season = best.get('twoSeasonDiff', False)

        # 每轮消耗的普通化肥时间 = 施肥阶段时长
        reg_per_cycle_sec = fert_phase_sec
        if is_two_season and is_s2_fert:
            # 二季作物：两次普化
            # 二季的最长阶段
            phases = best.get('phaseDetails', [])
            if len(phases) >= 2:
                s2_phases_sec = [max(1, round(p['seconds'] * (1 - LAND_BONUSES[min_land_level]['timeReduce'])))
                                 for p in phases[-2:]]
                s2_max = max(s2_phases_sec) if s2_phases_sec else 0
            else:
                s2_max = 0
            reg_per_cycle_sec = fert_phase_sec + s2_max

        # 有机化肥：施肥后剩余的生长时间需要有机催
        grow_time_fert = best.get('growTimeFert', 0)
        grow_time_total = best.get('growTimeSec', 0)
        if is_two_season:
            if is_s2_fert:
                # 一季有机 = 施肥后一季时间
                # 二季有机 = 施肥后二季时间
                org_per_cycle_sec = best.get('fullCycleGrowFertWithS2Sec', grow_time_fert) - 0
                # 有机催熟的是施肥后剩余时间
                s2_fert_sec = best.get('secondSeasonGrowFertSec', 0)
                org_per_cycle_sec = grow_time_fert + s2_fert_sec
            else:
                s2_sec = best.get('secondSeasonGrowSec', 0)
                org_per_cycle_sec = grow_time_fert + s2_sec
        else:
            org_per_cycle_sec = grow_time_fert

        total_reg_sec = reg_per_cycle_sec * cycles
        total_org_sec = org_per_cycle_sec * cycles

        reg_h = total_reg_sec / 3600
        org_h = total_org_sec / 3600

        # 土地加成信息
        effective_reduce_pct = LAND_BONUSES[min_land_level]['timeReduce']
        land_bonus_parts = []
        for lv in [4, 3, 2]:
            cnt = land_dist.get(lv, 0)
            if cnt > 0:
                land_bonus_parts.append({
                    'level': lv,
                    'count': cnt,
                    'reduce': LAND_BONUSES[lv]['timeReduce']
                })

        seg = {
            "level_start": range_start,
            "level_end": range_end,
            "crop_name": best['name'],
            "required_level": best['requiredLevel'],
            "lands": lands,
            "cycles": cycles,
            "exp_per_cycle": exp_per_cycle,
            "exp": actual_exp,
            "reg_h": round(reg_h, 1),
            "org_h": round(org_h, 1),
            "phase_count": best.get('phaseCount', 0),
            "fert_phase_names": best.get('fertBestPhaseNames', []),
            "fert_phase_orders": best.get('fertBestPhaseOrders', []),
            "fert_phase_sec": fert_phase_sec,
            "fert_phases_all_same": best.get('fertPhasesAllSame', False),
            "is_two_season": is_two_season,
            "effective_reduce_pct": effective_reduce_pct,
            "land_bonus_parts": land_bonus_parts,
        }
        segments.append(seg)
        exp_remaining -= actual_exp

    return segments, total_exp_needed


def _calc_level_bonus(cur_level, tgt_level):
    """计算升级福利（化肥+点券）"""
    # Lv1-39 每级给 20h 普化 + 80 点券
    # Lv40-59 每2级给 5h 普化 + 20 点券
    tier1_start = max(cur_level + 1, 1)
    tier1_end = min(tgt_level, 39)
    tier1_levels = max(0, tier1_end - tier1_start + 1) if tier1_start <= 39 else 0

    tier2_start = max(cur_level + 1, 40)
    tier2_end = min(tgt_level, 59)
    tier2_levels = max(0, tier2_end - tier2_start + 1) if tier2_start <= 59 else 0
    tier2_rewards = tier2_levels // 2

    tier1_fert_h = tier1_levels * 20
    tier1_coupons = tier1_levels * 80
    tier2_fert_h = tier2_rewards * 5
    tier2_coupons = tier2_rewards * 20

    return {
        'bonus_tier1_levels': tier1_levels,
        'bonus_tier1_fert_h': tier1_fert_h,
        'bonus_tier1_coupons': tier1_coupons,
        'bonus_tier2_levels': tier2_levels,
        'bonus_tier2_rewards': tier2_rewards,
        'bonus_tier2_fert_h': tier2_fert_h,
        'bonus_tier2_coupons': tier2_coupons,
        'level_bonus_fert_h': tier1_fert_h + tier2_fert_h,
        'level_bonus_coupons': tier1_coupons + tier2_coupons,
    }


def _calc_fert_purchase(hours_needed, plan_days, fert_type='reg'):
    """计算化肥购买方案"""
    items = []
    total_diamonds = 0
    remaining = hours_needed

    if fert_type == 'reg':
        # 普通化肥购买优先级：20h限购包(64💎) > 5h包(16💎) > 1h包(3.2💎)
        # 20h限购礼包: 64💎, 每日限购1次
        if remaining >= 20:
            packs_20h = min(int(remaining // 20), plan_days)
            if packs_20h > 0:
                cost = packs_20h * 64
                items.append({
                    'name': '20h普通化肥礼包',
                    'hours': 20,
                    'count': packs_20h,
                    'cost_each': 64,
                    'cost_total': cost,
                    'daily_limit': 1,
                    'days_needed': packs_20h,
                })
                remaining -= packs_20h * 20
                total_diamonds += cost

        # 5h包: 16💎
        if remaining >= 5:
            packs_5h = int(remaining // 5)
            if packs_5h > 0:
                cost = packs_5h * 16
                items.append({
                    'name': '5h普通化肥',
                    'hours': 5,
                    'count': packs_5h,
                    'cost_each': 16,
                    'cost_total': cost,
                    'daily_limit': 0,
                    'days_needed': 1,
                })
                remaining -= packs_5h * 5
                total_diamonds += cost

        # 1h包: 4💎（按剩余凑）
        if remaining > 0:
            packs_1h = math.ceil(remaining)
            cost = packs_1h * 4
            items.append({
                'name': '1h普通化肥',
                'hours': 1,
                'count': packs_1h,
                'cost_each': 4,
                'cost_total': cost,
                'daily_limit': 0,
                'days_needed': 1,
            })
            total_diamonds += cost

    else:
        # 有机化肥：10h包(40💎)
        if remaining >= 10:
            packs_10h = int(remaining // 10)
            cost = packs_10h * 40
            items.append({
                'name': '10h有机化肥',
                'hours': 10,
                'count': packs_10h,
                'cost_each': 40,
                'cost_total': cost,
                'daily_limit': 0,
                'days_needed': 1,
            })
            remaining -= packs_10h * 10
            total_diamonds += cost

        if remaining > 0:
            # 5h包: 20💎
            packs_5h = math.ceil(remaining / 5)
            cost = packs_5h * 20
            items.append({
                'name': '5h有机化肥',
                'hours': 5,
                'count': packs_5h,
                'cost_each': 20,
                'cost_total': cost,
                'daily_limit': 0,
                'days_needed': 1,
            })
            total_diamonds += cost

    return {'items': items, 'diamonds': total_diamonds}


def _build_recharge_plan(diamonds_needed, first_tiers):
    """构建充值推荐方案"""
    plan = []
    remaining = diamonds_needed

    # 首充档位
    FIRST_CHARGE_TIERS = {
        '6': {'yuan': 6, 'diamonds': 120, 'bonus': 60},
        '30': {'yuan': 30, 'diamonds': 600, 'bonus': 300},
        '98': {'yuan': 98, 'diamonds': 1960, 'bonus': 980},
        '198': {'yuan': 198, 'diamonds': 3960, 'bonus': 1980},
        '648': {'yuan': 648, 'diamonds': 12960, 'bonus': 6480},
    }

    # 添加首充档位
    for tier_key in first_tiers:
        if tier_key in FIRST_CHARGE_TIERS:
            t = FIRST_CHARGE_TIERS[tier_key]
            total_d = t['diamonds'] + t['bonus']
            plan.append({
                'type': '首充',
                'yuan': t['yuan'],
                'diamonds': total_d,
                'selected': True,
            })
            remaining -= total_d

    # 如果还需要更多
    if remaining > 0:
        normal_yuan = math.ceil(remaining / 10)
        plan.append({
            'type': '普通充值',
            'yuan': normal_yuan,
            'diamonds': normal_yuan * 10,
            'selected': True,
        })

    return plan


def calculate_exp_plan(params):
    """
    氪金计算器接口 /api/level_exp_calc 和 /api/level_exp_calc_save
    返回完整的升级方案数据，匹配前端 levels.html 所有期望字段
    """
    cur_level = int(params.get('cur_level', 1))
    tgt_level = int(params.get('tgt_level', 2))
    cur_exp = int(params.get('cur_exp', 0))
    fert_h = float(params.get('fert_h', 0))
    org_h = float(params.get('org_h', 0))
    cur_diamonds = int(params.get('cur_diamonds', 0))
    cur_coupons = int(params.get('cur_coupons', 0))
    plan_days = max(1, int(params.get('plan_days', 1)))
    svip = int(params.get('svip', 0)) == 1
    level_bonus = int(params.get('level_bonus', 0)) == 1
    super_monthly = int(params.get('super_monthly_card', 0)) == 1
    use_land_bonus = int(params.get('land_bonus', 0)) == 1
    optimal_limit = int(params.get('optimal_limit', 0)) == 1
    save_mode = 'level_exp_calc_save' in params.get('_path', '')

    first_tiers_str = params.get('first_tiers', '')
    first_tiers = [t.strip() for t in first_tiers_str.split(',') if t.strip()]

    if tgt_level <= cur_level:
        return {"error": f"目标等级(Lv{tgt_level})必须大于当前等级(Lv{cur_level})"}

    # 经验需求
    exp_needed = _get_total_exp(tgt_level) - _get_total_exp(cur_level) - cur_exp
    if exp_needed < 0:
        exp_needed = 0

    # 构建分段种植方案
    segments, total_exp = _build_segments(cur_level, tgt_level, cur_exp,
                                          is_smart_fert=True, is_s2_fert=True,
                                          use_land_bonus=use_land_bonus)

    if not segments:
        return {"error": "No crops found for this level"}

    # 汇总化肥需求
    total_reg_h = sum(seg['reg_h'] for seg in segments)
    total_org_h = sum(seg['org_h'] for seg in segments)

    # 免费化肥（每日赠送）
    daily_free_reg = 0
    daily_detail_parts = []
    if svip:
        daily_free_reg += 5
        daily_detail_parts.append('SVIP 5h')
    if super_monthly:
        daily_free_reg += 5
        daily_detail_parts.append('超级月卡 5h')
    free_fert_h = daily_free_reg * plan_days
    free_daily_detail = ' + '.join(daily_detail_parts) if daily_detail_parts else ''

    # 等级升级福利
    bonus_info = {}
    level_bonus_fert_h = 0
    level_bonus_coupons = 0
    if level_bonus:
        bonus_info = _calc_level_bonus(cur_level, tgt_level)
        level_bonus_fert_h = bonus_info.get('level_bonus_fert_h', 0)
        level_bonus_coupons = bonus_info.get('level_bonus_coupons', 0)

    # 点券计算
    daily_coupons = 0
    daily_coupons_rate = 0
    if svip:
        daily_coupons_rate += 10
    if super_monthly:
        daily_coupons_rate += 20
    total_daily_coupons = daily_coupons_rate * plan_days
    total_coupons = cur_coupons + level_bonus_coupons + total_daily_coupons

    # 点券兑换有机化肥: 42点券 = 10h有机化肥
    org_from_coupons_packs = total_coupons // 42
    org_from_coupons_h = org_from_coupons_packs * 10
    coupon_remainder = total_coupons - org_from_coupons_packs * 42

    # 已有化肥抵扣
    reg_saved_h = fert_h
    org_saved_h = org_h

    reg_to_buy = max(0, math.ceil(total_reg_h - reg_saved_h - free_fert_h - level_bonus_fert_h))
    org_to_buy = max(0, math.ceil(total_org_h - org_saved_h - org_from_coupons_h))

    # 最优限购模式：计算最少天数
    if optimal_limit:
        if reg_to_buy > 0:
            # 使用20h限购包最划算，计算需要多少天
            plan_days = max(1, math.ceil(reg_to_buy / 20))
            # 重新计算免费化肥
            free_fert_h = daily_free_reg * plan_days
            total_daily_coupons = daily_coupons_rate * plan_days
            total_coupons = cur_coupons + level_bonus_coupons + total_daily_coupons
            org_from_coupons_packs = total_coupons // 42
            org_from_coupons_h = org_from_coupons_packs * 10
            coupon_remainder = total_coupons - org_from_coupons_packs * 42
            reg_to_buy = max(0, math.ceil(total_reg_h - reg_saved_h - free_fert_h - level_bonus_fert_h))
            org_to_buy = max(0, math.ceil(total_org_h - org_saved_h - org_from_coupons_h))

    # 购买方案
    reg_purchase = _calc_fert_purchase(reg_to_buy, plan_days, 'reg') if reg_to_buy > 0 else {'items': [], 'diamonds': 0}
    org_purchase = _calc_fert_purchase(org_to_buy, plan_days, 'org') if org_to_buy > 0 else {'items': [], 'diamonds': 0}

    total_diamonds = reg_purchase['diamonds'] + org_purchase['diamonds']
    diamonds_to_recharge = max(0, total_diamonds - cur_diamonds)
    remaining_diamonds = cur_diamonds - total_diamonds if total_diamonds <= cur_diamonds else 0

    # 充值推荐
    recharge_plan = []
    if diamonds_to_recharge > 0:
        recharge_plan = _build_recharge_plan(diamonds_to_recharge, first_tiers)

    result = {
        "cur_level": cur_level,
        "tgt_level": tgt_level,
        "exp_needed": exp_needed,
        "plan_days": plan_days,
        "segments": segments,

        # 化肥汇总
        "total_reg_needed": round(total_reg_h, 1),
        "total_org_needed": round(total_org_h, 1),
        "reg_saved_h": round(reg_saved_h, 1),
        "org_saved_h": round(org_saved_h, 1),
        "free_fert_h": round(free_fert_h, 1),
        "free_daily_detail": free_daily_detail,
        "reg_to_buy": reg_to_buy,
        "org_to_buy": org_to_buy,
        "reg_purchase": reg_purchase,
        "org_purchase": org_purchase,

        # 钻石
        "total_diamonds": total_diamonds,
        "cur_diamonds": cur_diamonds,
        "diamonds_to_recharge": diamonds_to_recharge,
        "remaining_diamonds": remaining_diamonds,

        # 充值推荐
        "recharge_plan": recharge_plan,

        # 免费化肥来源
        "level_bonus_fert_h": level_bonus_fert_h,
        "level_bonus_coupons": level_bonus_coupons,

        # 点券
        "total_coupons": total_coupons,
        "cur_coupons": cur_coupons,
        "daily_coupons_rate": daily_coupons_rate,
        "total_daily_coupons": total_daily_coupons,
        "org_from_coupons_h": org_from_coupons_h,
        "coupon_remainder": coupon_remainder,

        # 模式标志
        "save_mode": save_mode,
        "optimal_limit": optimal_limit,
    }

    # 合并升级福利明细
    result.update(bonus_info)

    return result
