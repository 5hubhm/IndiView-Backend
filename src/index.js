import dotenv from "dotenv"
import connectDB from "./db/index.js";
import {app} from './app.js'

dotenv.config({
    path : './.env'
})

connectDB()
.then(()=>{
    app.listen(process.env.PORT || 8000, ()=>{
        console.log(`server is runnig at port : ${process.env.port}`);
    })
})
.catch((err)=>{
    console.log("MongoDB connection failed !!!", err)
})














// import express from "express"
// const app =  express()
// (async () => {
//     try {
//         await mongoose.connect(`{process.env.MONGODB_URI}`)
//         application.on("error", (error)=>{
//             console.log("ERROR : ", error);
//             throw error
//         })

//         application.listen(process.env.PORT, ()=>{
//             console.log(`App is listenning on port ${process.env.PORT}`);
//         })
//     } catch (error) {
//         console.error("ERROR : ", error)
//         throw error
//     }
// } )()


