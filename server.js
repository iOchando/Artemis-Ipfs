const express = require('express');
const app = express()
const fs = require('fs');
const https = require('https');
bodyParser = require("body-parser");
const morgan = require('morgan');
port = 3070;

const cors = require('cors');
const multer  = require('multer')

require('dotenv').config()

// Certificate
const privateKey = fs.readFileSync('/etc/letsencrypt/live/artemis-edu.com/privkey.pem', 'utf8');
const certificate = fs.readFileSync('/etc/letsencrypt/live/artemis-edu.com/cert.pem', 'utf8');
const ca = fs.readFileSync('/etc/letsencrypt/live/artemis-edu.com/chain.pem', 'utf8');

const credentials = {
	key: privateKey,
	cert: certificate,
	ca: ca
};

const web3storage = require('web3.storage')

const { Web3Storage, File } = web3storage

app.use(morgan('dev'))
app.use(cors({
  origin: '*'
}));

// Starting both http & https servers
const httpsServer = https.createServer(credentials, app);


app.use(bodyParser.json());
app.use(express.static(process.cwd() + '/my-app/dist'));

const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkaWQ6ZXRocjoweDQ4MzhCMjE0MDRDRjM2RjY4Rjk4RGJGMTg2NGE2MTU3MDc3N0VGOTciLCJpc3MiOiJ3ZWIzLXN0b3JhZ2UiLCJpYXQiOjE2NTE3NjExNTkwNTUsIm5hbWUiOiJpcGZzIn0._Z1-K1hzKNGWGLwE5jaN3rehwrVpXTyagjSOYLxdk2k"

app.post('/api/ipfs/files', cors(), multer().array('files'), async function (req, res) {
  if (req.files) {
    var item = []
    for (var i = 0; i < req.files.length; i++) {
      const client = new Web3Storage({ token })
      const files = [
        new File([req.files[i].buffer], req.files[i].originalname)
      ]
      const cid = await client.put(files)

      item.push({ data: cid, nombre: req.files[i].originalname })
    }
    res.json(item)
  } else {
    res.json(req.body)
  }
});

app.post('/api/ipfs', cors(), multer().single('file'), async function (req, res) {
  if (req.file) {
    const client = new Web3Storage({ token })
    const files = [
      new File([req.file.buffer], req.file.originalname)
    ]
    const cid = await client.put(files)

    return res.json({ data: cid, nombre: req.file.originalname })
  } else {
    res.json(req.body)
  }
});

app.use('/api/v1', require('./app/routes'))


httpsServer.listen(3070, () => {
	console.log('HTTPS Server running on port 3070');
});

// app.listen(port, () => {
//   console.log(`Server listening on the port::${port}`);
// });