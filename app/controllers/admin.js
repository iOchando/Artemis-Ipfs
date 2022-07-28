const axios = require('axios')
const { CONFIG } = require('../helpers/utils')
const nearAPI = require("near-api-js");
const nearSEED = require("near-seed-phrase");

const { utils, Contract, keyStores, KeyPair , Near, Account} = nearAPI;

const CONTRACT_NAME = process.env.CONTRACT_NAME;
const CONTRACT_NFT_NAME = process.env.CONTRACT_NFT_NAME;
const SIGNER_ID = process.env.SIGNER_ID;
const SIGNER_PRIVATEKEY = process.env.SIGNER_PRIVATEKEY;
const NETWORK = process.env.NETWORK;
const DJANGO_URL = process.env.DJANGO_URL;

const fs = require('fs')

const nodeHtmlToImage = require('node-html-to-image')

// inicio configuracion Web3 Storage //
const File = require('web3.storage').File
const Web3Storage = require('web3.storage').Web3Storage
const token = process.env.TOKEN_WEB3;
// fin configuracion Web3 Storage //

// inicio configuracion envio correo //
var nodemailer = require('nodemailer');
const hbs = require('nodemailer-express-handlebars')

const revisionCertificacion = async (req, res) => {
    try {
        const { datos, course_id, user_id } = req.body

        const keyStore = new keyStores.InMemoryKeyStore()

        const keyPair = KeyPair.fromString(SIGNER_PRIVATEKEY)
        keyStore.setKey(NETWORK, SIGNER_ID, keyPair)

        const near = new Near(CONFIG(keyStore))

        const account = new Account(near.connection, SIGNER_ID)

        const contract = new Contract(account, CONTRACT_NAME, {
            changeMethods: ['change_pass_certification'],
            viewMethods: ['get_course_id'],
            sender: account
        })

        const curso = await contract.get_course_id(
            {
                user_id: user_id,
                course_id: parseInt(course_id),
            },
        )

        if (curso) {
            method = 'post'
            url = DJANGO_URL+'api/v1/revision-certificacion/'
            let item = {
                course_id: course_id
            }

            await axios[method](url, item,
                {
                    headers:
                    {
                        'Content-Type': 'application/json',
                    },
                }).then(async (response) => {
                    let nota = 0
                    for (var i = 0; i < datos.length; i++) {
                        for (var j = 0; j < datos[i].options.length; j++) {
                            if (datos[i].options[j].isSelected === true) {
                                if (datos[i].options[j].option === response.data[i].respuesta) {
                                    nota += 2
                                }
                            }
                        }
                    }
                    console.log(nota)
                    if (nota >= 10) {
                        var user = await getDataUser(user_id)
                        var instructor = await getDataUser(curso.creator_id)

                        console.log("user", user)
                        console.log("instructor", instructor)

                        let user_name = String(user.name) + " "+ String(user.last_name)

                        const firma_url =  "https://www.artemis-edu.com/artemis-edu/artemis-edu/media_artemis/" + instructor.nombre_documento
                       
                        const cid = await crearImagen(user_id, curso.title, user_name, firma_url)

                        const contract_nft = new Contract(account, CONTRACT_NFT_NAME, {
                            changeMethods: ["set_certificate_list"],
                            sender: account
                        })

                        contract_nft.set_certificate_list({
                            callbackUrl: '',
                            meta: '',
                            args: {
                                user_name: user.name + " "+ user.last_name,
                                user_id: user_id,
                                instructor_name: instructor.name + " "+ instructor.last_name,
                                instructor_id: curso.creator_id,
                                curso: curso.title,
                                img_curso: curso.img,
                                img_certificado: "https://"+cid+".ipfs.dweb.link/"+user_id+"-"+curso.title+".png",
                            },
                            gas: '300000000000000'
                        }).then(async (response) => {
                            let item = {
                                curso: response.curso,
                                id_certificado: response.id,
                                img_certificado: response.img_certificado,
                                nota: nota
                            }
                            await contract.change_pass_certification(
                                {
                                    user_id: user_id,
                                    course_id: parseInt(course_id),
                                },
                            )
                            res.json(item)
                          })

                    } else {
                        await contract.change_pass_certification(
                            {
                                user_id: user_id,
                                course_id: parseInt(course_id),
                            },
                        )
                        res.json({nota: nota})
                    }
                }).catch((error) => {
                    res.status(404).json()
                })
        } else {
            return false
        }
    } catch (error) {
        console.log(error)
        res.status(404).json
    }
}

// funcion para creacion de la imagen del sertificado y subida al servicio ipfs web3 storage //
async function crearImagen(user_id, curso, user_name, firma) {
    try {
        console.log("Aqui")
        const imageCert = fs.readFileSync('./certificado.png');
        const base64ImageCert = new Buffer.from(imageCert).toString('base64');
        const dataURICert = 'data:image/png;base64,' + base64ImageCert

        const imageLogo = fs.readFileSync('./logo.png');
        const base64ImageLogo = new Buffer.from(imageLogo).toString('base64');
        const dataURILogo = 'data:image/png;base64,' + base64ImageLogo

        console.log("Aqui2")

        const image = await nodeHtmlToImage({
        html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link rel="icon" type="image/png" :href="logo" />
            <title>Certificado</title>
        </head>
        <body style="--certificado:url({{certificado}})">
            <section>
                <span>Otorgamos este</span>
                <h1>CERTIFICADO</h1>
                <h2>a: {{user_name}}</h2>
                <div class="inside">
                    <span>Ha aprobado el curso en modalidad e-learning</span>
                    <h3>{{curso}}</h3>
                </div>
            </section>

            <div class="firma">
                <div class="content">
                    <img src="{{firma}}" alt="firma">
                    <span>Instructor</span>
                </div>
            </div>

            <img class="logo" src="{{logo}}" alt="logo">
        </body>
        </html>

        <style>
        body {
            --distance: 1rem;
            font-family: sans-serif;
            display: grid;
            place-content: center;
            background: no-repeat var(--certificado);
            background-size: cover;
            height: 100vh;
            gap: 8em;
        }
        section {
            display: flex;
            flex-direction: column;
            gap: .5em;
        }
        section > span {
            text-indent: calc(var(--distance) * 7);
            font-size: 1.2em;
            font-weight: 500;
            color: hsl(0, 0%, 20%);
        }
        section h1 {
            text-indent: calc(var(--distance) * 0.3);
            font-size: 3.2em;
            font-weight: 600;
            color: #292b48;
        }
        section h2 {
            text-indent: calc(var(--distance) * 1);
            font-size: 1.4em;
            font-weight: 500;
            margin-bottom: .5em;
        }
        section > div span {
            margin-left: calc(var(--distance) * 1);
            font-size: 1.2em;
            font-weight: 500;
            color: hsl(22, 77%, 58%);
        }
        section h3 {
            max-width: 320px;
            margin-left: calc(var(--distance) * 3);
            font-size: 2em;
            font-weight: 500;
            color: #e56316;
        }
        .firma {
            --distancia: 4em;
            position: absolute;
            max-width: max-content; 
            bottom: 2em;
            left: 0;
            transform: translate(calc(var(--distance) * -4));
            right: 0;
            margin: auto;
        }
        .firma .content {
            position: relative;
        }
        .firma .content img {
            position: absolute;
            width: calc(100% - -3em);
            aspect-ratio: 16 / 9; 
            top: -5em;
            left: 0;
            right: 0;
            margin-inline: auto;
            transform: translateX(calc(var(--distancia) * -1 / 2.5));
        }
        .firma span {
            position: relative;
            font-size: 1.2em;
            font-weight: 500;
            max-width: max-content;
        }
        .firma span:before {
            content: "";
            position: absolute;
            top: -5px;
            left: 0;
            right: 0;
            margin: auto;
            width: calc(100% + var(--distancia));
            height: 1.3px;
            transform: translateX(calc(var(--distancia) * -1 / 2));
            background-color: #000000;
        }
        .logo {
            width: clamp(7em,8vw,8em);
            position: absolute;
            bottom: 0;
            left: 0;
        }
        h1,h2,h3 {margin:0}
        </style>
        `,
        content: { logo: dataURILogo, certificado: dataURICert, user_name: user_name, curso: curso, firma: firma },
        });
        console.log("image ",image)
        console.log("Aqui3")
        const client = new Web3Storage({ token })
        const files = [
        new File([image], user_id+"-"+curso+".png")
        ]

        console.log("Aqui4")

        const cid = await client.put(files)
        return cid
    } catch (error) {
        console.log(error)
        return false
    }
}

async function getDataUser(user_id) {
    try {
        method = 'get'
        url = DJANGO_URL + 'api/v1/profile/?wallet=' + user_id

        let resp = await axios[method](url)
            .then(async (response) => {
                if (response.data[0]) {
                    var item = response.data[0]
                    return item
                } else {
                    return false
                }
            }).catch((error) => {
                return false
            })
        return resp
    } catch (error) {
        console.log(error)
        return false
    }
}

module.exports = { revisionCertificacion }