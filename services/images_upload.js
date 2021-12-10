const aws = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
var ObjectID = require('mongodb').ObjectID;
let env = process.env.NODE_ENV || 'test';
// Set S3 endpoint to DigitalOcean Spaces
const spacesEndpoint = new aws.Endpoint('sfo3.digitaloceanspaces.com');
const s3 = new aws.S3({
  endpoint: spacesEndpoint,
  accessKeyId: process.env.DIGITALOCEAN_SPACE_ACCESS_KEY_ID,
  secretAccessKey: process.env.DIGITALOCEAN_SPACE_SECRET_ACCESS_KEY
});
let folder_name;

const upload = multer({
    storage: multerS3({
      s3: s3,
      bucket: 'tradket',
      acl: 'public-read',
      key: function (request, file, cb) {
        cb(null, env + "/" + folder_name + "/" + new ObjectID() + "_" + file.originalname);
      }
    })
}).array('image', 15);

const upload_custom = multer({
    storage: multerS3({
      s3: s3,
      bucket: 'tradket',
      acl: 'public-read',
      key: function (request, file, cb) {
        cb(null, env + "/" + folder_name + "/custom_products/" + new ObjectID() + "_" + file.originalname);
      }
    })
}).array('image', 15);
module.exports = {
    
    upload_custom_products: function(request, response, parent, callback){
        folder_name = parent;;
        upload_custom(request, response, function (error) {
            if (error) {
            return callback(true);
            }
            let all_images_size = 0;
            let images_path_arr = [];
            if(request.files){
                let imagesSize = 0;
                if(request.files.length > 0){
                    request.files.map((photo)=>{
                        imagesSize += photo.size;
                        images_path_arr.push(photo.location)
                    })
                    all_images_size = imagesSize * (1/(1024*1024));//MB
                }
            }
            callback(null, all_images_size, images_path_arr)
        })
    }
}