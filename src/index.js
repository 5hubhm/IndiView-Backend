import dotenv from "dotenv"
import connectDB from "./db/index.js";
import {app} from './app.js'

dotenv.config()

connectDB().then(() => {
    app.listen(process.env.PORT, () => {
        console.log(`Server is running at http://localhost:${process.env.PORT}`);
    });
});

// export default createServer(app); // Export as a serverless function

// import dotenv from "dotenv";
// import connectDB from "./db/index.js";
// import { app } from "./app.js";

// dotenv.config();

// export default async function handler(req, res) {
//     await connectDB(); // Ensure DB is connected before handling requests
//     return app(req, res); // Forward request to Express
// }














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


