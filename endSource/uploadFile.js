const inspect = require('util').inspect
const path = require('path')
const os = require('os')
const fs = require('fs')
const Busboy = require('busboy')


/**
 * 同步创建文件目录
 * @param  {string} dirname 目录绝对地址
 * @return {boolean}        创建目录结果
 */
function mkdirsSync(dirname) {
    if (fs.existsSync(dirname)) {
        return true
    } else {
        if (mkdirsSync(path.dirname(dirname))) {
            fs.mkdirSync(dirname)
            return true
        }
    }
}

/**
 * 获取上传文件的后缀名
 * @param  {string} fileName 获取上传文件的后缀名
 * @return {string}          文件后缀名
 */
function getSuffixName(fileName) {
    let nameList = fileName.split('.')
    return nameList[nameList.length - 1]
}

/**
 * 上传文件
 * @param  {object} ctx     koa上下文
 * @param  {object} options 文件上传参数 fileType文件类型， path文件存放路径
 * @return {promise}
 */
function uploadFile(ctx, options, secondPath, defaultFileName) {
    let req = ctx.req
    let res = ctx.res
    let busboy = new Busboy({ headers: req.headers })

    let filePath = options.path
    let mkdirResult = mkdirsSync(filePath)

    return new Promise((resolve, reject) => {
        let result = {
            success: false,
            message: '',
            data: null
        }

        // 解析请求文件事件
        busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
            let fileName = defaultFileName || Math.random().toString(16).substr(2) + '.' + getSuffixName(filename)
            let _uploadFilePath = path.join(filePath, fileName)
            let saveTo = path.join(_uploadFilePath)

            // 文件保存到制定路径
            file.pipe(fs.createWriteStream(saveTo))

            // 文件写入事件结束
            file.on('end', function() {
                result.success = true
                result.message = '文件上传成功'
                result.data = {
                    fileUrl: `${secondPath}/${fileName}`
                }
                resolve(result)
            })
        })

        // 解析结束事件
        busboy.on('finish', function() {
            resolve(result)
        })

        // 解析错误事件
        busboy.on('error', function(err) {
            reject(result)
        })

        req.pipe(busboy)
    })

}

module.exports = {
    uploadFile
}
