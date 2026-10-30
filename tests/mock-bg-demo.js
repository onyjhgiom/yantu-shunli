/* 临时冒烟测试：考研背景默认示例替换 + bgV 迁移逻辑 */
const store = {};
global.wx = {
  setStorageSync: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
  getStorageSync: (k) => (k in store ? JSON.parse(JSON.stringify(store[k])) : ''),
  removeStorageSync: (k) => { delete store[k]; }
};
const profile = require('../services/profile');
const db = require('../services/db');

function fresh() {
  Object.keys(store).forEach((k) => delete store[k]);
  db.invalidate();
  profile.ensureDefaults();
  return profile.getBackground();
}

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.log('FAIL: ' + name); } }

// 1) 新装机：默认是虚构示例（江汉大学/杭州/11408/学硕），且与旧示例（池州/上海/22408/安徽大学）零重合
let bg = fresh();
ok('新装-院校=江汉大学', bg.undergradSchool === '江汉大学');
ok('新装-层次=一本', bg.undergradTier === '一本');
ok('新装-奖项=蓝桥杯', bg.awards.indexOf('蓝桥杯') === 0);
ok('新装-城市=杭州', bg.settleCity === '杭州');
ok('新装-方向=11408', bg.examPath === '11408');
ok('新装-学硕', bg.targetDegree === '学硕');
ok('新装-一志愿=杭电', bg.primaryChoice.indexOf('杭州电子科技大学') === 0);
ok('新装-保底=浙工大', bg.backupChoice.indexOf('浙江工业大学') === 0);
ok('新装-家庭=无上海字样', bg.familySupport.indexOf('上海') < 0);
ok('新装-带bgV标记', bg.bgV === 2);

// 2) 旧设备（此前被写入池州/安徽大学示例、无 bgV）：ensureDefaults 应覆盖成新示例
Object.keys(store).forEach((k) => delete store[k]);
const oldProfile = {
  name: '乐天哥', avatar: '', setup: true, createdAt: 1, updatedAt: 2,
  background: {
    undergradSchool: '池州学院', undergradTier: '二本',
    awards: 'A类大学生创新创业大赛省奖', codingLevel: 'beginner',
    codingLevelText: '会一点（待强化）', targetDegree: '专硕', settleCity: '上海',
    familySupport: '上海有房有车，资产充裕，试错成本低', examPath: '22408',
    primaryChoice: '安徽大学·计算机技术(专硕)',
    backupChoice: '安徽大学·计算机科学与技术(学硕)', updatedAt: 2
  }
};
store.yt_profile = oldProfile;
db.invalidate();
profile.ensureDefaults();
bg = profile.getBackground();
ok('旧示例被覆盖', bg.undergradSchool === '江汉大学' && bg.examPath === '11408');
ok('覆盖后带bgV', bg.bgV === 2);

// 3) 用户自己改过的数据（bgV=2）：不被覆盖
Object.keys(store).forEach((k) => delete store[k]);
store.yt_profile = {
  name: '小明', avatar: '', setup: true, createdAt: 1, updatedAt: 2,
  background: {
    undergradSchool: '我自己的学校', undergradTier: '211', bgV: 2, updatedAt: 3
  }
};
db.invalidate();
profile.ensureDefaults();
bg = profile.getBackground();
ok('用户数据不被覆盖', bg.undergradSchool === '我自己的学校');
ok('用户数据补齐字段', bg.settleCity === '杭州'); // 缺失字段由默认值合并补齐

// 4) setBackground 保存后 bgV 保留，再次 ensureDefaults 不回滚
Object.keys(store).forEach((k) => delete store[k]);
profile.ensureDefaults();
profile.setBackground({ undergradSchool: '自定义大学' });
profile.ensureDefaults();
bg = profile.getBackground();
ok('保存后不被回滚', bg.undergradSchool === '自定义大学' && bg.bgV === 2);

console.log('PASS ' + pass + ' / FAIL ' + fail);
process.exit(fail ? 1 : 0);
