const share = require('../../utils/share');
const taskService = require('../../services/task');
const theme = require('../../utils/theme');
const util = require('../../utils/util');

const themeStore = require('../../utils/theme');
Page({
  onShareAppMessage: function () { return share.build(this, 'pages/task-edit/task-edit'); },
  onShareTimeline: function () { return share.timeline(this, 'pages/task-edit/task-edit'); },

  data: {
    themeCls: '',
    id: '',
    isEdit: false,
    saving: false,
    title: '',
    description: '',
    subjects: [],
    subjectLabels: [],
    subjectIndex: 3,
    priorityLabels: [],
    priorityKeys: [],
    priorityIndex: 2,
    planTypeLabels: ['日计划', '周计划', '月计划', '阶段计划'],
    planTypeKeys: ['day', 'week', 'month', 'stage'],
    planTypeIndex: 0,
    date: '',
    estimatedMinutes: '',
    tagsText: '',
    parentId: '',
    parentTitle: '',
    children: [],
    status: 'todo'
  },
  /* 主题：同步皮肤 class + 导航栏 / tabBar + 需要真实色值的组件属性。
   * 注意：switch 等原生组件的 color 是「属性值」而非样式，吃不了 var()，必须传真值。 */
  _applyTheme() {
    const p = themeStore.palette();
    this.setData({
      themeCls: themeStore.activeClass(),
      themeKey: themeStore.active().key,
      swColor: p.forest,
      barColor: p.forest
    });
    themeStore.applyChrome();
  },
  onShow() { this._applyTheme(); },



  onLoad(options) {
    const subjects = theme.SUBJECTS.concat([theme.SUBJECT_MAP.other]);
    const priorityKeys = ['urgent', 'high', 'mid', 'low'];
    this.setData({
      subjects,
      subjectLabels: subjects.map((s) => s.name),
      priorityKeys,
      priorityLabels: priorityKeys.map((k) => theme.PRIORITY[k].label),
      date: options.date || util.dateStr(),
      parentId: options.parentId || '',
      planTypeIndex: Math.max(0, this.data.planTypeKeys.indexOf(options.planType || 'day'))
    });

    if (options.parentId) {
      const parent = taskService.get(options.parentId);
      if (parent) this.setData({ parentTitle: parent.title });
      wx.setNavigationBarTitle({ title: '新建子任务' });
    }

    if (options.id) {
      const t = taskService.get(options.id);
      if (t) {
        this.setData({
          id: t.id,
          isEdit: true,
          title: t.title,
          description: t.description,
          status: t.status,
          subjectIndex: Math.max(0, subjects.findIndex((s) => s.key === t.subject)),
          priorityIndex: Math.max(0, priorityKeys.indexOf(t.priority)),
          planTypeIndex: Math.max(0, this.data.planTypeKeys.indexOf(t.planType)),
          date: t.date,
          estimatedMinutes: t.estimatedMinutes || '',
          tagsText: (t.tags || []).join(','),
          parentId: t.parentId || ''
        });
        this.loadChildren();
        wx.setNavigationBarTitle({ title: '编辑任务' });
      }
    } else {
      wx.setNavigationBarTitle({ title: this.data.parentId ? '新建子任务' : '新建任务' });
    }
  },

  loadChildren() {
    const children = taskService.children(this.data.id)
      .map((t) => Object.assign({}, t, { childCount: 0 }));
    this.setData({ children });
  },

  onInput(e) {
    const f = e.currentTarget.dataset.field;
    this.setData({ [f]: e.detail.value });
  },
  onSubject(e) { this.setData({ subjectIndex: Number(e.detail.value) }); },
  onPriority(e) { this.setData({ priorityIndex: Number(e.detail.value) }); },
  onPlanType(e) { this.setData({ planTypeIndex: Number(e.detail.value) }); },
  onDate(e) { this.setData({ date: e.detail.value }); },

  save() {
    const d = this.data;
    const title = (d.title || '').trim();
    if (!title) {
      wx.showToast({ title: '请填写任务标题', icon: 'none' });
      return;
    }
    if (d.saving) return;
    this.setData({ saving: true });

    const payload = {
      title,
      description: (d.description || '').trim(),
      subject: d.subjects[d.subjectIndex].key,
      priority: d.priorityKeys[d.priorityIndex],
      planType: d.planTypeKeys[d.planTypeIndex],
      date: d.date,
      estimatedMinutes: Math.max(0, Number(d.estimatedMinutes) || 0),
      tags: (d.tagsText || '').split(/[,，\s]+/).filter(Boolean)
    };

    try {
      if (d.isEdit) {
        taskService.update(d.id, payload);
      } else {
        payload.parentId = d.parentId || '';
        payload.status = 'todo';
        taskService.add(payload);
      }
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 500);
    } catch (err) {
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
      this.setData({ saving: false });
    }
  },

  toggleComplete() {
    taskService.toggle(this.data.id);
    this.loadChildren();
    this.setData({ status: this.data.status === 'done' ? 'todo' : 'done' });
    wx.showToast({ title: this.data.status === 'done' ? '已完成' : '已恢复', icon: 'none' });
  },

  remove() {
    wx.showModal({
      title: '删除任务',
      content: '删除后不可恢复，子任务也会一并删除。',
      confirmColor: themeStore.palette().danger,
      success: (res) => {
        if (res.confirm) {
          taskService.remove(this.data.id);
          wx.navigateBack();
        }
      }
    });
  },

  addSubtask() {
    if (!this.data.isEdit) return;
    wx.navigateTo({ url: `/pages/task-edit/task-edit?parentId=${this.data.id}&date=${this.data.date}` });
  },

  onChildTap(e) { wx.navigateTo({ url: `/pages/task-edit/task-edit?id=${e.detail.task.id}` }); },
  onChildToggle(e) { taskService.toggle(e.detail.task.id); this.loadChildren(); }
});
