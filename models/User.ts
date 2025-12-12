import { Document, Model, Schema, model, models } from "mongoose";

export interface UserDocument extends Document {
  email: string;
  password: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true });

const User: Model<UserDocument> = models.User || model<UserDocument>("User", userSchema);

export default User;
