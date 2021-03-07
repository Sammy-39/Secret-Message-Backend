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
            Don't tell it to anyone...
         </p>`
    );
}


router.post('/create-message', async (req, res) => {
    try {
        const client = await mongoClient.connect(DB_URL);
        const db = client.db('secretMessage');
        const salt = await bcrypt.genSalt(saltrounds);
        const hash = await bcrypt.hash(req.body.password, salt);
        const data = {
            key: req.body.randomKey,
            password: hash,
            message: req.body.message
        }
        await db.collection('secretMessage').insertOne(data);
        const result = await db.collection('secretMessage').findOne({key: data.key});
        const usrMailUrl = `${req.body.targetURL}/${result._id}`;
        mailData.to = req.body.targetMail;
        mailData.html = mailMessage(usrMailUrl)
        await transporter.sendMail(mailData);
        res.status(200).json({message: "secret message is send. Don't forget yout secret key and password", result})
        client.close()
    } catch (error) {
        console.log(error.message);
        res.sendStatus(500);
    }
})

router.get('/message-by-id/:id', async (req, res) => {
    try {
        const client = await mongoClient.connect(DB_URL);
        const db = client.db('secretMessage');
        const result = await db.collection('secretMessage').find({_id: objectId(req.params.id)}).project({password: 0, _id: 0, key: 0}).toArray();
        res.status(200).json({message: result[0].message})
        client.close()
    } catch (error) {
        console.log(error);
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
        console.log(error);
        res.sendStatus(500);
    } 
})


router.listen(port, () => console.log("::: Server is UP and running successfully :::"))