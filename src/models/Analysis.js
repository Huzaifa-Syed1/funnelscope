import mongoose from 'mongoose';

const funnelStepSchema = new mongoose.Schema({
  label: {
    type: String,
    required: true,
    trim: true,
    maxlength: 80
  },
  value: {
    type: Number,
    required: true,
    min: 0
  }
}, { _id: false });

const analysisSchema = new mongoose.Schema({
  steps: {
    type: [funnelStepSchema],
    required: true
  },
  metrics: {
    conversionRate: {
      type: Number,
      required: true
    },
    biggestDrop: {
      type: Number,
      required: true
    },
    worstStep: {
      type: String,
      required: true
    }
  },
  insights: {
    type: String,
    required: true,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  versionKey: false
});

analysisSchema.index({ createdAt: -1 });

export default mongoose.model('Analysis', analysisSchema);
