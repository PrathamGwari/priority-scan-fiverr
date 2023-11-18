// const asyncHandler = require("express-async-handler");
const User = require("../models/userModel")
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken")


function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

//@desc Register the user
//@route POST /api/users/register
//@access public
const registerUser = asyncHandler(async (req, res) => {
    const {email, password} = req.body;
    if (!email || !password){
        res.status(400).send("All fields are mandatory");
        return;
        // return "All fields are mandatory"
    }
    // const users = await User.find()
    // res.status(200).json(users)
    const userAvailable = await User.find({ email });
    console.log(`userAvailable: ${userAvailable}`)
    if (userAvailable.length > 0) {
        res.status(400).send("User already register");
        return;
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("Hashed password: ", hashedPassword);
    const user = await User.create({
        email,
        password: hashedPassword
    })
    // console.log(`User created ${user}`);
    if (user) {
        user.save()
        res.status(201).json({ _id: user.id, email: user.email })
    }else{
        res.status(400)
        return "User data is not valid";
    }
    res.json({"message": "Register the user"})
})

//@desc Login the user
//@route POST /api/users/login
//@access public
const loginUser = asyncHandler(async (req, res) => { 
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400).send({message: "All fields are mandatory"});
        return;
    }
    const user = await User.findOne({ email });
    // compare password with hashed password
    if (!user) {
        await res.status(401).send({message: `User with this email (${email}) was not registered.`});
        return;
    }
    console.log(password)
    console.log(user.password)
    console.log(password===user.password)
    console.log(await bcrypt.compare(password, user.password))
    if (await bcrypt.compare(password, user.password)) {
        const accessToken = jwt.sign({
            user: {
                email: user.email,
                id: user.id
            }
        }, process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "100m" })
        res.status(200).json({accessToken: accessToken, dataDecoded: {email: user.email, id: user.id}});
    } else {
        await res.status(401).send({message: "Email or password is not valid"});
        return;
    }
})

const verifyToken = (token) => {
    try{
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        return decoded
    } catch(err){
        return false
    }
}

//@desc Check is user logged in
//@route GET /api/users/isLoged
//@access private
const isLoged = asyncHandler(async (req, res) => {
    const token = req.body.accessToken;
    if (!token) {
        console.log("Token was not provided")
        await res.status(401).send({message: "Token was not provided", wasVerified: false})
        return
    } 
    const decoded = verifyToken(token)
    if (decoded) {
        console.log('Token was verified')
        await res.status(200).send({decoded: decoded, message: "Token was verified successfuly!", wasVerified: true})
        // тренболон
        return
    } else {
        console.log('token was NOT verified')
        await res.status(401).send({message: "Token wan not verified", wasVerified: false})
    }
})


//@desc Current user info
//@route GET /api/users/userdata
//@access private
const currentUserData = asyncHandler(async (req, res) => {
    const providedData = req.body;
    console.log('PROVIDED DATA')
    console.log(providedData)
    var token = providedData.accessToken;
    if (!token) {
        console.log("Token was not provided")
        await res.status(401).send({message: "Token was not provided", wasVerified: false})
        return
    } 
    const decoded = verifyToken(token)
    if (decoded) {
        console.log('Token was verified')
        var email = req.body.email
        var password = req.body.password
        if (!email){
            await res.status(401).send({message: "No email provided. Try one more time please.", wasVerified: true})
            return
        }
        var userData = await User.findOne({email})
        // console.log(`password, userData.password ${password}, ${userData.password}`)
        console.log(`userData: ${userData}`)
        if(!await bcrypt.compare(password, userData.password)){
            await res.status(401).send({message: "There is an error with user data. Try one more time please. Not right password.", wasVerified: true})
        }
        if (!userData){
            await res.status(401).send({message: "There is an error with user data. Try one more time please. There is not this user.", wasVerified: true})
        }else{
            userData.password = req.body.password
            await res.status(200).send({userData: userData, wasVerified: true})
        }
        console.log(res.status)
        // тренболон
        return
    } else {
        console.log('token was NOT verified')
        await res.status(401).send({message: "Session was expired. Please log in.", wasVerified: false})
    }
})

async function updateUserByEmail(updateData, user) {  
      const updatedFields = {};
      for (const key in updateData) {
        if (user[key] !== updateData[key] && updateData !== '') {
          user[key] = updateData[key];
          updatedFields[key] = updateData[key];
        }
      }
  
      if (Object.keys(updatedFields).length > 0) {
        await user.save();
        console.log('User updated:', updatedFields);
      } else {
        console.log('No changes detected.');
      }
  }


//@desc Update user info
//@route POST /api/users/updateuserdata
//@access private
const updateUserData = asyncHandler(async (req, res) => {
    const providedData = req.body;
    const newData = {
        firstName: providedData.firstName,
        lastName: providedData.lastName,
        birthday: providedData.birthday,
        address: providedData.address,
        phoneNumber: providedData.phoneNumber,
        familyDoctorName: providedData.familyDoctorName,
        email: providedData.email,
        password: providedData.password,
    }
    const newEmail = providedData.email
    const newPassword = providedData.password
    
    const oldEmail = providedData.oldEmail
    const oldPassword = providedData.oldPassword
    const token = providedData.accessToken;
    if (!token) {
        console.log("Token was not provided")
        await res.status(401).send({message: "Token was not provided", wasVerified: false})
        return
    } 
    const decoded = verifyToken(token)
    if (newEmail.length === 0 || newPassword.length === 0){
        await res.status(401).send({message: "Email or password can not be void", wasVerified: false})
        return
    }
    if (decoded) {
        console.log('Token was verified')
        if (!oldEmail){
            await res.status(401).send({message: "No email provided. Try one more time please.", wasVerified: true})
            return
        }
        var userData = await User.findOne({email: oldEmail})
        // console.log(`password, userData.password ${password}, ${userData.password}`)
        // console.log(`userData: ${userData}`)
        console.log('0')
        if (!userData){
            await res.status(401).send({message: "There is an error with user data. Try one more time please. No user with this email.", wasVerified: true})
            return;
        }
        console.log('1')
        if(!await bcrypt.compare(oldPassword, userData.password)){
            await res.status(401).send({message: "There is an error with user data. Try one more time please. Not right password.", wasVerified: true})
            return;
        }
        console.log('3')

        newData.password = await bcrypt.hash(newData.password, 10);
        await updateUserByEmail(newData, userData)
        await res.status(200).send({userData: newData, newPassword: newPassword, newEmail: newEmail, wasVerified: true})
        console.log(res.status)
        // тренболон
        return
    } else {
        console.log('token was NOT verified')
        await res.status(401).send({message: "Session was expired. Please log in.", wasVerified: false})
    }
})




module.exports = { registerUser, loginUser, isLoged, verifyToken, currentUserData, updateUserData }