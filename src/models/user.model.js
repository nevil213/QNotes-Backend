import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";


const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            match:  /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        },
        isEmailVerified: {
            type: Boolean,
            default: false
        },
        fullname: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        avatar: {
            type: String, // cloudinary url
        },
        coverImage: {
            type: String, // cloudinary url
        },
        notes: [{
            type: Schema.Types.ObjectId,
            ref: "Note"
        }],
        watchHistory: [{
            type: Schema.Types.ObjectId,
            ref: "Note"
        }],
        savedPlaylist: [{
            type: Schema.Types.ObjectId,
            ref: "Playlist"
        }],
        password: {
            type: String,
            required: [true, "password is required"]
        },
        refreshToken: {
            type: String
        },
        otp: {
            type: String
        },
        otpExpiry: {
            type: Date
        }

    }, {timestamps: true});


// pre hook in mongoose, will run before doint that event (here save)

userSchema.pre("save", async function (next) {
    if(!this.isModified("password")) return next();

    this.password = await bcrypt.hash(this.password, 10)
    next();
})


//custom methods in mongoose

userSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password)
}


userSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            _id: this._id,
            username: this.username,
            email: this.email,
            fullname: this.fullname
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}

userSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        {
            _id: this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

userSchema.methods.createOtpAndToken = function () {
    const otp = Math.floor(Math.random() * 900000 + 100000)
    const otpExpiry = new Date(Date.now() + 15 * 1000 * 60)
    const token = jwt.sign({
        email: this.email,
        otp
    }, process.env.JWT_SECRET, {
        expiresIn: '15m'
    })

    this.otp = otp;
    this.otpExpiry = otpExpiry;

    this.save({validateBeforeSave: false})

    return {
        otp, token
    }
}

export const User = mongoose.model("User", userSchema);