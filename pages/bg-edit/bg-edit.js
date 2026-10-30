const profileService = require('../../services/profile');

const TIERS = ['985', '211', '双一流', '一本', '二本', '普通本科', '专科', '海外'];
const CODING = [
  { key: 'none', text: '几乎不会' },
  { key: 'beginner', text: '会一点（待强化）' },
  { key: 'intermediate', text: '入门，能做小项目' },
  { key: 'advanced', text: '熟练，刷题无压力' }
];
const DEGREES = ['学硕', '专硕'];
const PATHS = ['22408', '11408', '自命题', '其他'];

function idxOf(arr, v) { const i = arr.indexOf(v); return i < 0 ? 0 : i; }

Page({
  data: {
    tiers: TIERS,
    degrees: DEGREES,
    paths: PATHS,
    codingTexts: CODING.map((c) => c.text),
    form: {},
    tierIdx: 0,
    degreeIdx: 0,
    pathIdx: 0,
    codingIdx: 0
  },

  onLoad() {
    const bg = profileService.getBackground();
    this.setData({
      form: {
        undergradSchool: bg.undergradSchool || '',
        undergradTier: bg.undergradTier || '一本',
        awards: bg.awards || '',
        codingLevel: bg.codingLevel || 'intermediate',
        codingLevelText: bg.codingLevelText || CODING[2].text,
        targetDegree: bg.targetDegree || '学硕',
        settleCity: bg.settleCity || '',
        familySupport: bg.familySupport || '',
        examPath: bg.examPath || '11408',
        primaryChoice: bg.primaryChoice || '',
        backupChoice: bg.backupChoice || ''
      },
      tierIdx: idxOf(TIERS, bg.undergradTier),
      degreeIdx: idxOf(DEGREES, bg.targetDegree),
      pathIdx: idxOf(PATHS, bg.examPath),
      codingIdx: Math.max(0, CODING.findIndex((c) => c.key === (bg.codingLevel || 'intermediate')))
    });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ ['form.' + field]: e.detail.value });
  },

  onTier(e) {
    const i = +e.detail.value;
    this.setData({ tierIdx: i, 'form.undergradTier': TIERS[i] });
  },

  onDegree(e) {
    const i = +e.detail.value;
    this.setData({ degreeIdx: i, 'form.targetDegree': DEGREES[i] });
  },

  onPath(e) {
    const i = +e.detail.value;
    this.setData({ pathIdx: i, 'form.examPath': PATHS[i] });
  },

  onCoding(e) {
    const i = +e.detail.value;
    this.setData({ codingIdx: i, 'form.codingLevel': CODING[i].key, 'form.codingLevelText': CODING[i].text });
  },

  save() {
    profileService.setBackground(this.data.form);
    wx.showToast({ title: '已保存', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 500);
  }
});
