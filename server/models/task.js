const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  icon: { type: String, default: '🎯' },
  reward: { type: Number, required: true }, // Reward in PHMN
  link: { type: String, required: true },
  type: { type: String, default: 'social' }, // e.g., 'social', 'external'
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Task', taskSchema);
