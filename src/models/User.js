import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 80
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 160
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    select: false
  }
}, {
  timestamps: {
    createdAt: true,
    updatedAt: false
  }
});

export default mongoose.model('User', userSchema);
