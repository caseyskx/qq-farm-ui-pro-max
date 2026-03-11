const test = require('node:test');
const assert = require('node:assert/strict');

const {
    getAllSeeds,
    getPlantById,
    getPlantName,
    getPlantNameBySeedId,
    getSeedImageBySeedId,
} = require('../src/config/gameConfig');

test('seed images fall back to asset_name mapping when seed_images_named uses generic Crop files', () => {
    const image = getSeedImageBySeedId(20249);
    assert.equal(image.endsWith('/seed_images_named/Crop_249_Seed.png'), true);
});

test('plant names fall back to ItemInfo seed metadata when Plant.json entry is missing', () => {
    assert.equal(getPlantNameBySeedId(20112), '风信子');
    assert.equal(getPlantName(1020112), '风信子');

    const plant = getPlantById(1020112);
    assert.equal(plant && plant.seed_id, 20112);
    assert.equal(plant && plant.land_level_need, 61);
    assert.equal(plant && plant.size, 1);
});

test('all seeds includes ItemInfo-derived seeds outside Plant.json coverage', () => {
    const seed = getAllSeeds().find(item => Number(item.seedId) === 20249);
    assert.equal(!!seed, true);
    assert.equal(seed && seed.name, '荷包牡丹');
    assert.equal(seed && seed.requiredLevel, 61);
    assert.equal(String(seed && seed.image).endsWith('/seed_images_named/Crop_249_Seed.png'), true);
});
