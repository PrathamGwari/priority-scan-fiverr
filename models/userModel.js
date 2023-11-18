const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    // username: {
    //     type: String,
    //     required: [true, "Please add the user name"]
    // },
    email: {
        type: String,
        required: [true, "Please add the user email address"],
        unique: [true, "Email address already taken"]
    },
    password: {
        type: String,
        required: [true, "Please add the user password"],
    },
    firstName: {
        type: String,
    },
    lastName: {
        type: String,
    },
    birthday: {
        type: String,
    },
    address: {
        type: String,
    },
    phoneNumber: {
        type: String,
    },
    familyDoctorName: {
        type: String,
    },
    userCurrentAppt: Array,
    newlyFoundAppt: Array   
},
{
    timestamps: true
});

const User = mongoose.model('User', UserSchema)

module.exports = User