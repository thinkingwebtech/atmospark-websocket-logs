
import mongoose from "mongoose";
const Schema = mongoose.Schema;

const AdminSchema = new Schema({
  email: {
    type: String,
    require: true
  },
  password: {
    type: String,
    require: true
  },
  users: []

});

const ADMIN = mongoose.model("ADMIN", AdminSchema);
export default ADMIN