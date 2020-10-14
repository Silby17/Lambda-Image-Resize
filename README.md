# AWS Lambda Image Resize

An AWS Lambda function that will resize and compress images when an image.
This function will be triggered when a new image is uploaded to a defined AWS S3 bucket.

I found 2 different articles which do the same but I could not get either of them working.
The [first](https://github.com/dariospadoni/aws-lambda-image-compressor) and the [second](http://jice.lavocat.name/blog/2015/image-conversion-using-amazon-lambda-and-s3-in-node.js/). I kept getting errors with certain packages and with missing layers, with that I decided to write this user friendly and simple guide. 

## Basic Flow
- Function should be invoked by an AWS S3 trigger when a new image is uploaded to a defined bucket. 
- Once triggered, the function will resize and compress the image
- The new images will be saved in a bucket with the name of your current bucket with a suffix of `-output`
- Each resized image will be saved in its corresponding folder

You can easily configure the widths of the resized image and their destination bucket/subfolder

## Usage
- Create you Lambda function with an AWS S3 trigger
- Run `npm install` to install all dependencies
- Now, pack the `index.js` script and the `node_modules` in a zip archive.
- Upload this package to your Lambda
- Define your Lambdas timeout, memory size and description
- Define your Lambda Layers
    - You will need deploy and then add the [image-magick-lambda-layer](https://serverlessrepo.aws.amazon.com/applications/arn:aws:serverlessrepo:us-east-1:145266761615:applications~image-magick-lambda-layer) to your Lambda Layers
