import { Schema, model } from 'mongoose';
import bcryptjs from 'bcryptjs';

const userSchema = new Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  summaryHistory: [{ type: Schema.Types.ObjectId, ref: 'Summary' }]
});

userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcryptjs.hash(this.password, 10);
  }
  next();
});

export const User = model('User', userSchema); 