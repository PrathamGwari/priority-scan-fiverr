const connectToDB = require('../dbConnection')
const fs = require('fs').promises
const csv = require('fs').createReadStream
const { parse } = require("csv-parse");
const HospitalCT = require('../models/hospitalsCTModel')
const HospitalMR = require('../models/hospitalsMRModel')
const HospitalFieldsNames = require('../config').HospitalFieldsNames
const axios = require("axios")
const NodeGeocoder = require('node-geocoder');
const geolib = require('geolib');
const { registerUser, loginUser, isLoged, verifyToken } = require('./userController');
const moment = require('moment');



// now its local code to upload .csv files

const mainFolder = '../hospitalData/'

async function getFilesFromFolder(folderName){
    const directoryPath = `${mainFolder}${folderName}`;
    var files = await fs.readdir(directoryPath, (err, files) => {});
    return files
}

async function saveDataFromFile(array, DBmodel, path){
    await DBmodel.insertMany(array)
    console.log(`Added ${array.length} documents to MongoDB from ${path}`)
}

async function getDataFromFileAndSaveToDB(fileName, folder, DBmodel){
    var results = [];
    const path = `${mainFolder}${folder}/${fileName}`
    csv(path)
        .pipe(parse({ delimiter: ",", from_line: 2 }))
        .on("data", function (row) {
            row = row.slice(1)
            const row_obj = {}
            row_obj[HospitalFieldsNames[0]] = row[0]
            for (var row_i = 1; row_i < row.length; row_i++){
                var parsedInt = parseInt(row[row_i])
                if (isNaN(parsedInt)) parsedInt = -1
                row_obj[HospitalFieldsNames[row_i]] = parsedInt
            }
            // console.log(row_obj)
            results.push(row_obj)
        })
        .on("error", function (error) {console.log(error.message)})
        .on("end", function () {
            console.log(`Parsed ${results.length} strings from ${path}`)
            saveDataFromFile(results, DBmodel, path)
        });
}


async function updateDataInDatabase(){
    await connectToDB()
    
    await HospitalCT.deleteMany({});
    var CTfiles = await getFilesFromFolder('CT')
    for (i in CTfiles) getDataFromFileAndSaveToDB(CTfiles[i], 'CT', HospitalCT)
    
    await HospitalMR.deleteMany({});
    var MRfiles = await getFilesFromFolder('MR')
    for (i in MRfiles) getDataFromFileAndSaveToDB(MRfiles[i], 'MR', HospitalMR)
}

// updateDataInDatabase()

async function getDistance(vendorAddress, deliveryAddress){
    try{
        vendorAddress = vendorAddress.replaceAll(' ', '+')
        deliveryAddress = deliveryAddress.replaceAll(' ', '+')
        const apiKey = 'AIzaSyB8TccjucJ16WZxOKleFxZceRUB17wfjL8'
        const apiUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?destinations=${vendorAddress}&origins=${deliveryAddress}&units=imperial&key=${apiKey}`
        const response = await axios.get(apiUrl)
        var miles = parseFloat(response.data.rows[0].elements[0].distance.text.replaceAll(',', ''))
        if (isNaN(miles)) return false
        var kilometers = miles * 1.60934
        return kilometers
    }
    catch(error){
        return false
    }
}

// getDistance('Эденбридж-Хамбер Вэлли, Торонто, Онтарио, Канада', 'Бедфорд Парк, Торонто, Онтарио, Канада')


function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

//@desc Get nearest hospital to address
//@route POST /api/hospitals/getclosest
//@access public
const getHospitalWithClosestAppointment = asyncHandler(async (req, res) => {
    // accessToken: localStorage.getItem('accessToken'),
    // livingPlace: document.getElementById('livingPlace').value,
    // appointmentType: document.getElementById('appointmentType').value,
    // appointmentDate: document.getElementById('appointmentDate').value,
    // maxDistance: document.getElementById('maxDistance').value
    const {livingPlace, appointmentType, appointmentDate, maxDistance} = req.body;
    const targetDate = moment(appointmentDate);
    const currentDate = moment();
    const duration = moment.duration(targetDate.diff(currentDate));
    const daysRemaining = duration.asDays();
    
    console.log({   livingPlace, appointmentType, appointmentDate, maxDistance})
    if (!appointmentType || !livingPlace || !appointmentDate || !maxDistance){
        res.status(400).send({message: "All fields are mandatory."});
        return;
    }
    var model_obj;
    if (appointmentType === 'ct'){model_obj = HospitalCT;}
    else if(appointmentType === 'mr'){model_obj = HospitalMR;}
    else{
        res.status(400).send({message: "Error, try one more time."});
        return;
    }
    const allHospitals = await model_obj.find({}).exec();
    console.log(allHospitals.length)
    const hospitalInDistance = []
    for (var hospital_index = 0; hospital_index < allHospitals.length; hospital_index++){
        var distance = await getDistance(livingPlace, allHospitals[hospital_index].Site)
        // console.log(allHospitals[hospital_index].Site)
        // console.log(distance)
        if (distance !== false){
            if (distance <= maxDistance){
                var medianWait = allHospitals[hospital_index].val_2023_Median_Wait
                if ((medianWait === 0) || (medianWait === -1) || (medianWait > daysRemaining)){}
                else hospitalInDistance.push({Site: allHospitals[hospital_index].Site, medianWait: medianWait, distance: distance})
            }
        }
    }
    // console.log(`hospitalInDistance.length: ${hospitalInDistance.length}`)
    console.log(hospitalInDistance)

    var responceData;
    if (hospitalInDistance.length === 0){
        responceData = {
            'message': 'We are sorry, there are no closer appointment'
        }
    }
    else{
        var listOfClosestHospitals = []

        var isSorted = false;
        while (!isSorted){
            isSorted = true;
            for (var i = 0; i < hospitalInDistance.length - 1; i++){
                if (hospitalInDistance[i].medianWait > hospitalInDistance[i + 1].medianWait){
                    var transport = hospitalInDistance[i];
                    hospitalInDistance[i] = hospitalInDistance[i + 1];
                    hospitalInDistance[i + 1] = transport;
                    isSorted = false;
                }
            }
        }

        if (hospitalInDistance.length < 5){
            listOfClosestHospitals = hospitalInDistance;
        }
        else{
            listOfClosestHospitals = hospitalInDistance.slice(0, 5);
        }




        var closestHospital = listOfClosestHospitals[0]

        // var closestHospital = hospitalInDistance[0]
        // for (var hospital_index = 1; hospital_index < hospitalInDistance.length; hospital_index++){
        //     if (hospitalInDistance[hospital_index].medianWait < closestHospital.medianWait){
        //         closestHospital = hospitalInDistance[hospital_index]
        //     }
        // }

        const currentDate = new Date();
        const newDate = new Date();
        newDate.setDate(currentDate.getDate() + closestHospital.medianWait);
        const year = newDate.getFullYear();
        const month = String(newDate.getMonth() + 1).padStart(2, '0'); // +1, так как месяцы начинаются с 0
        const day = String(newDate.getDate()).padStart(2, '0');
        const formattedDate = `${year}-${month}-${day}`;

        const appointmentDateObj = new Date(appointmentDate);
        const timeDifference = appointmentDateObj - newDate;
        const daysDifference = parseInt(timeDifference / (1000 * 60 * 60 * 24));
        
        responceData = {
            'appointmentPlace': closestHospital.Site,
            'appointmentType': appointmentType,// TODO: change it
            'appointmentDateSoonerCount': daysDifference,
            'appointmentDate': formattedDate,
            'maxDistance': maxDistance,
            'listOfClosestHospitals': listOfClosestHospitals,
        }
    }
    res.status(200).json(responceData);
})

// NOTES: old code of the getHospitalWithClosestAppointment function
// const getHospitalWithClosestAppointment = asyncHandler(async (req, res) => {
//     // accessToken: localStorage.getItem('accessToken'),
//     // livingPlace: document.getElementById('livingPlace').value,
//     // appointmentType: document.getElementById('appointmentType').value,
//     // appointmentDate: document.getElementById('appointmentDate').value,
//     // maxDistance: document.getElementById('maxDistance').value
//     const {livingPlace, appointmentType, appointmentDate, maxDistance} = req.body;
//     const targetDate = moment(appointmentDate);
//     const currentDate = moment();
//     const duration = moment.duration(targetDate.diff(currentDate));
//     const daysRemaining = duration.asDays();
    
//     console.log({   livingPlace, appointmentType, appointmentDate, maxDistance})
//     if (!appointmentType || !livingPlace || !appointmentDate || !maxDistance){
//         res.status(400).send({message: "All fields are mandatory."});
//         return;
//     }
//     var model_obj;
//     if (appointmentType === 'ct'){model_obj = HospitalCT;}
//     else if(appointmentType === 'mr'){model_obj = HospitalMR;}
//     else{
//         res.status(400).send({message: "Error, try one more time."});
//         return;
//     }
//     const allHospitals = await model_obj.find({}).exec();
//     console.log(allHospitals.length)
//     const hospitalInDistance = []
//     for (var hospital_index = 0; hospital_index < allHospitals.length; hospital_index++){
//         var distance = await getDistance(livingPlace, allHospitals[hospital_index].Site)
//         // console.log(allHospitals[hospital_index].Site)
//         // console.log(distance)
//         if (distance !== false){
//             if (distance <= maxDistance){
//                 var medianWait = allHospitals[hospital_index].val_2023_Median_Wait
//                 if ((medianWait === 0) || (medianWait === -1) || (medianWait > daysRemaining)){}
//                 else hospitalInDistance.push({Site: allHospitals[hospital_index].Site, medianWait: medianWait, distance: distance})
//             }
//         }
//     }
//     // console.log(`hospitalInDistance.length: ${hospitalInDistance.length}`)
//     console.log(hospitalInDistance)

//     var responceData;
//     if (hospitalInDistance.length === 0){
//         responceData = {
//             'message': 'We are sorry, there are no closer appointment'
//         }
//     }
//     else{
//         var closestHospital = hospitalInDistance[0]
//         for (var hospital_index = 1; hospital_index < hospitalInDistance.length; hospital_index++){
//             if (hospitalInDistance[hospital_index].medianWait < closestHospital.medianWait){
//                 closestHospital = hospitalInDistance[hospital_index]
//             }
//         }
//         const currentDate = new Date();
//         const newDate = new Date();
//         newDate.setDate(currentDate.getDate() + closestHospital.medianWait);
//         const year = newDate.getFullYear();
//         const month = String(newDate.getMonth() + 1).padStart(2, '0'); // +1, так как месяцы начинаются с 0
//         const day = String(newDate.getDate()).padStart(2, '0');
//         const formattedDate = `${year}-${month}-${day}`;

//         const appointmentDateObj = new Date(appointmentDate);
//         const timeDifference = appointmentDateObj - newDate;
//         const daysDifference = parseInt(timeDifference / (1000 * 60 * 60 * 24));
        
//         responceData = {
//             'appointmentPlace': closestHospital.Site,
//             'appointmentType': appointmentType,// TODO: change it
//             'appointmentDateSoonerCount': daysDifference,
//             'appointmentDate': formattedDate,
//             'maxDistance': maxDistance
//         }
//     }
//     res.status(200).json(responceData);
// })


module.exports = { getHospitalWithClosestAppointment }