let async = require('async');
let path = require('path');
let AWS = require('aws-sdk');
require('dotenv').config();
let Q = require('q');
let gm = require('gm').subClass({
    imageMagick: true
});

let s3 = new AWS.S3();
exports.handler = function (event, context) {
    let srcBucket = event.Records[0].s3.bucket.name;
    // Bucket where processed images will be saved
    let destinationBucket = srcBucket + "-output";
    console.log("Destination Bucket:", destinationBucket)

    // Object key may have spaces or unicode non-ASCII characters.
    let srcKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));
    let srcPath = path.dirname(srcKey) + '/';
    console.log("Source Path:", srcPath)

    if (srcPath === './') {
        srcPath = '';
    }
    // Compressed images desired width and subfolder
    let _1020px = {
        width: 1020,
        destinationPath: "large"
    };
    let _600px = {
        width: 600,
        destinationPath: "medium"
    };
    let _400px = {
        width: 400,
        destinationPath: "small"
    };
    let _sizesArray = [_1020px, _600px, _400px];

    // Infer the image type.
    let typeMatch = srcKey.match(/\.([^.]*)$/);
    let fileName = path.basename(srcKey);
    if (!typeMatch) {
        console.error('Unable to infer image type for key ' + srcKey);
        return;
    }
    let imageType = typeMatch[1].toLowerCase();
    let imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'eps'];

    if (imageTypes.indexOf(imageType) === -1) {
        console.log('Skipping non-image ' + srcKey);
        return;
    }
    console.log('Optimizing Image ' + srcKey);
    async.waterfall([
            function download(next) {
                console.log('Attempting to Download the image');
                s3.getObject({
                    Bucket: srcBucket,
                    Key: srcKey
                }, next);
            },

            function convert(response, next) {
                console.log('Attempting to convert the image');
                gm(response.Body)
                    .antialias(true)
                    .density(72)
                    .toBuffer('jpg', function (err, buffer) {
                        if (err) {
                            console.log('Error converting image, calling next with error:', err)
                            next(err);
                        } else {
                            next(null, buffer);
                        }
                    });
            },

            function process(response, next) {
                let promises = [];

                function processImage(response, index) {
                    let deferred = Q.defer();
                    console.log('Processing image');
                    // Get the image size
                    gm(response).size(function (err, imgSize) {
                        let width = _sizesArray[index].width;
                        let position = fileName.lastIndexOf('.');
                        let key = srcPath + _sizesArray[index].destinationPath + "/" + fileName.slice(0, position) + ".jpg";

                        if (imgSize.width > width) {
                            console.log('Resizing image ' + imgSize.width + ' --> ' + width);
                            this.resize(width).toBuffer('jpg', function (err, buffer) {
                                if (err) {
                                    deferred.reject(err);
                                    return;
                                }
                                console.log('Uploading image ' + key + ' to bucket ' + destinationBucket);
                                s3.putObject({
                                    Bucket: destinationBucket,
                                    Key: key,
                                    Body: buffer,
                                    ContentType: 'image/jpeg',
                                    ACL: 'public-read'
                                }, function () {
                                    console.log('Image successfully uploaded');
                                    deferred.resolve();
                                });
                            });
                        } else {
                            // If the image is smaller than the current resize width no resizing is needed
                            // the image will just be copied to the destination bucket
                            console.log('Skipping image resizing');
                            this.toBuffer('jpg', function (err, buffer) {
                                console.log('Uploading image ' + key + ' to bucket ' + destinationBucket);
                                s3.putObject({
                                    Bucket: destinationBucket,
                                    Key: key,
                                    Body: buffer,
                                    ContentType: 'image/jpeg',
                                    ACL: 'public-read'
                                }, function () {
                                    console.log('Image successfully uploaded');
                                    deferred.resolve();
                                });
                            });
                        }
                    });
                    return deferred.promise;
                }

                for (let i = 0; i < _sizesArray.length; i++) (function (i) {
                    promises.push(processImage(response, i));
                })(i);

                return Q.all(promises).then(
                    function () {
                        console.log('All image resizing completed');
                        next(null);
                    }, function (err) {
                        console.log('Some images were not able to be resized:', err);
                        next(err);
                    });
            }
        ],
        function waterfallCallback(err) {
            if (err) {
                console.error('Error during the image optimization:', err);
            } else {
                console.log('Successfully resized and saved all images');
            }
            context.done();
        });
};