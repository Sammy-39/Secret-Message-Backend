const express = require('express');
const mongodb = require('mongodb');
const cors = require('cors');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');

const router = express();
router.use(express.json());
router.use(cors());
dotenv.config();

const mongoClient = mongodb.MongoClient;
const objectId = mongodb.ObjectID;
const DB_URL = process.env.DBURL
const port = process.env.PORT || 5000;
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;
const saltrounds = 10;

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: EMAIL,
        pass: PASSWORD,
    }
})

const mailData = {
    from: process.env.EMAIL,
    subject: "S*CR*T M*SSAG*"
}

const mailMessage = (url) => {
    return (
        `<p>Hi this is Raavan from gaming World,<br />
            you have a SECRET MESSAGE waiting for only you to open. <br />
            <a href='${url}' target='_blank'>${url}</a><br />
            Use first 4 letters of your email and the current month number as password to access your message <br />
            Example: if your email is asdfg@gmail.com and current month is march, the password would be asdf3 <br />
            Don't tell it to anyone... <br />
            The link expires after 5 minute.
         </p>`
    );
}


router.post('/create-message', async (req, res) => {
    try {
        const client = await mongoClient.connect(DB_URL);
        const db = client.db('secretMessage');
        const salt = await bcrypt.genSalt(saltrounds);
        const hash = await bcrypt.hash(req.body.password, salt);
        const userHash = await bcrypt.hash(req.body.targetMail.slice(0,4)+(new Date().getMonth()+1),10)
        const data = {
            key: req.body.randomKey,
            password: hash,
            message: req.body.message,
            createdAt: new Date(),
            userPassword: userHash
        }
        const check = await db.collection('secretMessage').findOne({key:data.key})
        if(check){
            res.status(422).json("Secret key in use")
            return
        }
        await db.collection('secretMessage').insertOne(data);
        const result = await db.collection('secretMessage').findOne({key: data.key});
        const usrMailUrl = `${req.body.targetURL}/?rs=${result._id}`;
        mailData.to = req.body.targetMail;
        mailData.html = mailMessage(usrMailUrl)
        await transporter.sendMail(mailData);
        res.status(200).json({message: "secret message is send. Don't forget yout secret key and password", result})
        client.close()
    } catch (error) {
        console.log(error);
        res.sendStatus(500);
    }
})

router.get('/message-by-id/:id/:password', async (req, res) => {
    try {
        const client = await mongoClient.connect(DB_URL);
        const db = client.db('secretMessage');
        const result = await db.collection('secretMessage').find({_id: objectId(req.params.id)}).project({_id: 0, password: 0 ,key: 0, createdAt: 0}).toArray();
        if(result.length!==0){
            const compare = await bcrypt.compare(req.params.password, result[0].userPassword);
            if (compare){
                res.status(200).json({message: result[0].message})
            }else{
                res.status(401).json({message: "incorrect password!"})
            }
        }
        else{
            res.status(400).json({message:"Link expired or message deleted!"})
        }
        client.close()
    } catch (error) {
        console.log(error)
        res.sendStatus(500);
    }
})

router.get('/message-by-key/:key/:password', async (req, res) => {
    try {
        const client = await mongoClient.connect(DB_URL);
        const db = client.db('secretMessage');
        const result = await db.collection('secretMessage').find({key: req.params.key}).project({_id: 0, userPassword: 0 ,key: 0, createdAt: 0}).toArray();;
        if(result.length!==0){
            const compare = await bcrypt.compare(req.params.password, result[0].password);
            if (compare){
                res.status(200).json({message: result[0].message})
            }else{
                res.status(401).json({message: "incorrect password!"})
            }
        }else{
            res.status(404).json({message: "secret key not found!!!"})
        }
        client.close()
    } catch (error) {
        console.log(error)
        res.sendStatus(500);
    } 
})

router.patch('/edit-message', async (req, res) => {
    try {
        const client = await mongoClient.connect(DB_URL);
        const db = client.db('secretMessage');
        const secret = await db.collection('secretMessage').findOne({key: req.body.secretKey});
        if(secret){
            const compare = await bcrypt.compare(req.body.password, secret.password);
            if (compare){
                console.log(req.body.message)
                const updateRes = await db.collection('secretMessage').findOneAndUpdate({key: req.body.secretKey},{$set: {message:req.body.message}});
                console.log(updateRes)
                res.status(200).json({message: "Message updated successfully!"});
            }else{
                res.status(401).json({message: "Incorrect password!"})
            }
        }else{
            res.status(404).json({message: "Secret key not found!!!"})
        }
        client.close()
    } catch (error) {
        console.log(error)
        res.sendStatus(500);
    } 
})

router.delete('/delete-message', async (req, res) => {
    try {
        const client = await mongoClient.connect(DB_URL);
        const db = client.db('secretMessage');
        const secret = await db.collection('secretMessage').findOne({key: req.body.secretKey});
        if(secret){
            const compare = await bcrypt.compare(req.body.password, secret.password);
            if (compare){
                await db.collection('secretMessage').findOneAndDelete({key: req.body.secretKey});
                res.status(200).json({message: "message has been deleted successfully"});
            }else{
                res.status(401).json({message: "incorrect password!"})
            }
        }else{
            res.status(404).json({message: "secret key not found!!!"})
        }
        client.close()
    } catch (error) {
        console.log(error)
        res.sendStatus(500);
    } 
})


router.listen(port, () => console.log("::: Server is UP and running successfully :::"))