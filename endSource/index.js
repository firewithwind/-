const koa = require('koa');
const koaBody = require('koa-body')
const mysql = require('mysql')
const config = require('./config')
const path = require('path')
const static = require('koa-static')
const { uploadFile } = require('./uploadFile.js')
const fs = require('fs')
const qs = require('querystring')
const { createPersonReim } = require('./utils/index.js')

const app = new koa();

var connection = mysql.createConnection(config);

connection.connect(function(err) {
    if (err) {
        console.error('error connecting: ' + err.stack);
        return;
    }

    console.log('connected as id ' + connection.threadId);
});

const fileType = [
    'css',
    'less',
    'gif',
    'html',
    'ico',
    'jpeg',
    'jpg',
    'js',
    'json',
    'pdf',
    'png',
    'svg',
    'swf',
    'tiff',
    'txt',
    'wav',
    'wma',
    'wmv',
    'xml',
    'xlsx'
]

app.use(koaBody())

app.use(async(ctx, next) => {
    let param = ctx.request.body
    let select = null,
        result = null
    let extendName = ctx.url.split('.').slice(-1)[0]
    if (fileType.indexOf(extendName) !== -1) {
        await next()
    } else {
        switch (true) {
            case /\/changePersonLevel/.test(ctx.url):
                let queryParam = qs.parse(ctx.url.split('?')[1])
                select = `update user set level = ${queryParam.id} where id="liulianxing"`
                result = await querySQL(select)
                ctx.body = 'success'
                break
            case /^[\/]?$/.test(ctx.url):
                ctx.url = `/static/dist/index.html`
                await next()
                break
            case /\/login/.test(ctx.url):
                if (!param.id || !param.pwd) {
                    ctx.throw(400, 'bad userID or password')
                } else {
                        select = `select * from user where id = "${param.id}" or phone = "${param.id}" and pwd = "${param.pwd}"`
                        result = await querySQL(select)
                        if (!result.state) {
                            ctx.throw(400, result.msg)
                        } else {
                            ctx.body = result.body[0]
                        }
                }
                break
            case /\/register/.test(ctx.url):
                if (!param.id||!param.pwd||!param.name||!param.phone||!param.laboratory) {
                    ctx.throw(400, 'bad register information')
                } else {
                    select = `insert into user
                            values("${param.id}", "${param.name}", "${param.phone}", "${param.Email}", 0, "${param.pwd}", NULL, ${param.laboratory})`
                    result = await querySQL(select)
                    if (!!result.state) {
                        ctx.body = {
                            type: 0,
                            msg: 'success'
                        }
                    } else {
                        ctx.throw(500, result.msg)
                    }
                }
                break
            case /\/getUserInfor/.test(ctx.url):
                if (!!param.id) {
                    select = `select * from user where id = "${param.id}"`
                    result = await querySQL(select)
                    if (!!result.state) {
                        ctx.body = result.body[0]
                    } else {
                        ctx.throw(400, result.msg)
                    }
                } else {
                    ctx.throw(400, 'bad userID in request');
                }
                break
            case /\/getProjects/.test(ctx.url):
                if (!!param.id) {
                    select = `select p.*
                            from project p join user_pro u on p.id = u.pid
                            where u.uid = "${param.id}"`
                    result = await querySQL(select)
                    if (!!result.state) {
                        ctx.body = result.body
                    } else {
                        ctx.throw(500, 'a error occured in server')
                    }
                } else {
                    ctx.throw(400, 'bad user ID in param')
                }
                break
            case /\/createRequestion/.test(ctx.url):
                if (!param.user) {
                    ctx.throw(400, 'bad request body of user')
                } else if (!param.startTime) {
                    ctx.throw(400, 'bad request body of startTime')
                } else if (!param.endTime) {
                    ctx.throw(400, 'bad request body of endTime')
                } else if (!param.requester) {
                    ctx.throw(400, 'bad request body of requester')
                } else if (!param.way) {
                    ctx.throw(400, 'bad request body of way')
                } else if (!param.destination) {
                    ctx.throw(400, 'bad request body of destination')
                } else {
                    select = 'insert into requestion values(NULL, 1,' +
                        param.project + ',"' +
                        param.requester + '","' +
                        Date.now() + '","' +
                        param.startTime + '","' +
                        param.endTime + '",' +
                        param.way + ',"' +
                        param.destination + '","' +
                        param.description + '", NULL, NULL)'
                    result = await querySQL(select)
                    if (!!result.state) {
                        ctx.body = {
                            id: result.body.insertId
                        }
                    } else {
                        ctx.throw(400, result.msg)
                    }
                }
                break
            case /\/getRequestionDetail/.test(ctx.url):
                if (!!param.id) {
                    select = `select *
                            from user u join requestion r on r.requester = u.id
                            where r.id=${param.id}`
                    result = await querySQL(select)
                    if (!!result.state) {
                        ctx.body = result.body[0]
                    } else {
                        ctx.throw(400, result.msg)
                    }
                } else {
                    ctx.throw(400, 'bad requestion ID in request');
                }
                break
            case /\/getUndoneRequestion/.test(ctx.url):
                if (!!param.id) {
                    select = `select *
                            from requestion
                            where requester="${param.id}" and state<2`
                    result = await querySQL(select)
                    if (!!result.state) {
                        ctx.body = result.body
                    } else {
                        ctx.throw(400, result.msg)
                    }
                } else {
                    ctx.throw(400, 'bad userID in request');
                }
                break
            case /\/getUndoneReimbursement/.test(ctx.url):
                if (!!param.id) {
                    select = `select *
                            from requestion
                            where requester="${param.id}" and state>=3 and state<5`
                    result = await querySQL(select)
                    if (!!result.state) {
                        ctx.body = result.body
                    } else {
                        ctx.throw(400, result.msg)
                    }
                } else {
                    ctx.throw(400, 'bad userID in request');
                }
                break
            case /\/getUnremarkRequestion/.test(ctx.url):
                if (!!param.id) {
                    select = `select level
                            from user
                            where id="${param.id}"`
                    var queryRes = await querySQL(select)
                    if (!!queryRes.state) {
                        if(queryRes.body.length > 0) {
                            var level = queryRes.body[0].level
                        } else {
                            ctx.throw(500, 'unexcept error')
                        }
                    } else {
                        ctx.throw(400, 'no this user')
                    }
                    if (level == 1) {
                        select = `select *
                                from user u join requestion r on r.requester=u.id
                                where state < 2`
                        result = await querySQL(select)
                        if (!!result.state) {
                            ctx.body = result.body
                        } else {
                            ctx.body = result.msg
                        }
                    } else if (level == 2) {
                        select = `select *
                                from user u join requestion r on r.requester=u.id
                                where state > 2 and state < 5`
                        result = await querySQL(select)
                        if (!!result.state) {
                            ctx.body = result.body
                        } else {
                            ctx.throw(400, result.msg)
                        }
                    } else {
                        ctx.throw(400, 'you have no acception for remarking')
                    }
                } else {
                    ctx.throw(400, 'bad userID in request');
                }
                break
            case /\/deleteRequestion/.test(ctx.url):
                if (param.id && param.uid) {
                    select = `delete
                            from requestion
                            where id=${param.id} and requester="${param.uid}"`
                    result = await querySQL(select)
                    if (!!result.state) {
                        ctx.body = {
                            type: 0,
                            msg: 'success'
                        }
                    } else {
                        ctx.throw(400, result.msg)
                    }
                } else {
                    ctx.throw(400, 'bad params in request')
                }
                break
            case /\/approveRequestion/.test(ctx.url):
                if (!param.id || !param.ope) {
                    select = `select level from user where id="${param.uid}"`
                    var queryRes = await querySQL(select)
                    if (!!queryRes.state) {
                        var level = queryRes.body[0].level
                    } else {
                        ext.throw(400, 'no this user')
                    }
                    if ((level === 1 && param.state < 2) || (level === 2 && param.state >= 3 && param.state <= 4)) {
                        if (param.operate === 0) {
                            select = `update requestion
                                    set state=state+1, approver="${param.uid}" where id=${param.id}`
                            result = await querySQL(select)
                            if (!!result.state) {
                                ctx.body = {
                                    type: 0,
                                    msg: 'success'
                                }
                            } else {
                                ctx.throw(400, result.msg)
                            }
                        }
                    } else {
                        ctx.throw(400, 'you have no acception for remarking')
                    }
                } else {
                    etx.throw(400, 'bad param in requestion')
                }
                break
            case /\/addReimbursement/.test(ctx.url):
                if (!!param.requestion) {
                    select = [`insert
                            into reimbursement
                            values(NULL,
                            ${param.requestion},
                            ${param.type},
                            "${Date.now()}",
                            "${param.money}",
                            "${param.startAddress}",
                            "${param.startDate}",
                            "${param.startTime}",
                            "${param.endAddress}",
                            "${param.endDate}",
                            "${param.endTime}",
                            "${param.seat}",
                            "${param.desc}",
                            NULL, NULL, "${param.note}"
                            )`, `update requestion set state=3 where id=${param.requestion}`]
                    result =await querySQL(select)
                    if (!!result.state) {
                        ctx.body = {
                            type: 0,
                            msg: 'success'
                        }
                    } else {
                        ctx.throw(400, result.msg)
                    }
                } else {
                    ctx.throw(400, 'bad param in requestion')
                }
                break
            case /\/getReimbursements/.test(ctx.url):
                if (!!param.id) {
                    select = `select * from reimbursement where requestion=${param.id}`
                    result = await querySQL(select)
                    if (!!result.state) {
                        ctx.body = result.body
                    } else {
                        ctx.throw(400, result.msg)
                    }
                } else {
                    ctx.throw(400, 'bad requestion id in param')
                }
                break
            case /\/getCreatableReim/.test(ctx.url):
                if (!!param.id ) {
                    select = `select *
                            from user u join requestion r on u.id=r.requester
                            where r.requester="${param.id}" and state>=2 and state <3`
                    result = await querySQL(select)
                    if (!!result.state) {
                        ctx.body = result.body
                    } else {
                        ctx.throw(400, result.msg)
                    }
                } else {
                    ctx.throw(400, 'bad userID in param')
                }
                break
            case /\/getFindRequestion/.test(ctx.url):
                let limit = param.limit
                let user = param.user
                let key = 0
                select = 'select * from user u join requestion r on r.requester=u.id where '
                if (!!param.id) {
                    select += `r.id=${param.id} and`
                    key = 1
                }
                if (!!param.name) {
                    if (!isNaN(param.name)) {
                        select += ` (u.id=${param.name} or u.name="${param.name}") and`
                    } else {
                        select += ` u.name="${param.name}" and`
                    }
                    key = 1
                }
                if (!!param.state) {
                    select += ` r.state=${param.state} and`
                    key = 1
                }
                if (!!param.project) {
                    select += ` r.project=${param.project} and`
                    key = 1
                }
                if (!!param.startDate) {
                    select += ` occurTime >= "${param.startDate}" and occurTime <= "${param.endDate}" and`
                    key = 1
                }
                if (!key) {
                    select += `r.requester="${user}"`
                } else {
                    select = select.slice(0, -4)
                }
                let sitem = await querySQL(select.replace('*', 'count(*)'))
                select += ` limit ${limit.offset}, ${limit.count}`
                result = await querySQL(select)
                if (!!sitem.state && !!result.state) {
                    ctx.body = {
                        results: result.body,
                        acount: sitem.body[0] ? sitem.body[0]['count(*)'] : 0
                    }
                } else {
                    ctx.throw(400, result.msg)
                }
                break
            case /\/deleteReim/.test(ctx.url):
                if (!!param.id) {
                    select = `delete from reimbursement where id = ${param.id}`
                    result = await querySQL(select)
                    if (!!result.state) {
                        ctx.body = {
                            type: 1,
                            msg: 'success'
                        }
                    } else {
                        ctx.throw(400, result.msg)
                    }
                } else {
                    ctx.throw(400, 'bad reimbursement id in param')
                }
                break
            case /\/uploadInvoice\?requestion=[/m/M]*/.test(ctx.url):
                let serverFilePath = path.join( __dirname, 'static/invoice')
                // 上传文件事件
                let query = qs.parse(ctx.url.split('?')[1])
                if (!!query.requestion) {
                    result = await uploadFile( ctx, {
                        fileType: 'album',
                        path: serverFilePath
                    })
                    if (!!result.data.pictureUrl) {
                        select = `insert into invoice values(NULL, ${query.requestion}, "http://${ctx.host}/static/${result.data.pictureUrl}", "${Date.now()}")`
                        result.data.create = await querySQL(select)
                        if (!!result.data.create.state) {
                            ctx.body = {
                                id: result.data.create.body.insertId,
                                url: `http://${ctx.host}/static/${result.data.pictureUrl}`
                            }
                        } else {
                            fs.unlink(path.resolve(__dirname, 'static/' + result.data.pictureUrl))
                            ctx.throw(400, result.body.create.msg)
                        }
                    } else {
                        ctx.throw(500, 'can not upload the picture')
                    }
                } else {
                    ctx.throw(400, 'bad requestion id in param')
                }
                break
            case /\/getInvoices/.test(ctx.url):
                if (!!param.requestion) {
                    select = `select * from invoice where requestion=${param.requestion}`
                    result = await querySQL(select)
                    if (!!result.state) {
                        ctx.body = result.body
                    } else {
                        ctx.throw(400, result.msg)
                    }
                } else {
                    ctx.throw(400, 'bad requestion id in param')
                }
                break
            case /\/deleteInvoice/.test(ctx.url):
                if (!!param.id) {
                    let _savePath = path.resolve(__dirname, 'static/', param.url.split('static/')[1])
                    fs.unlink(_savePath, (err) => {
                        if (err) {
                            ctx.throw(400, 'can not delete the file')
                        }
                    })
                    select = `delete from invoice where id=${param.id}`
                    result = await querySQL(select)
                    if (!!result.state) {
                        ctx.body = {
                            type: 1,
                            message: 'success'
                        }
                    } else {
                        ctx.throw(400, result.msg)
                    }
                }
                break
            case /\/getPersonData/.test(ctx.url):
                if (!!param.id) {
                    select  = `select reim.*, req.id as rid, pro.id as pid, pro.title
                                from requestion req right join reimbursement reim on req.id = reim.requestion
                                right join project pro on pro.id = req.project
                                where req.requester = "${param.id}"
                                and reim.startDate >= ${param.startDate}
                                and reim.endDate <= ${param.endDate}
                                order by reim.startDate`
                    result = await querySQL(select)
                    if (!!result.state) {
                        ctx.body = result.body
                    } else {
                        ctx.throw(400, result.msg)
                    }
                } else {
                    ctx.throw(400, 'bad user id in param')
                }
                break
            case /\/getRangeYearData/.test(ctx.url):
                if (!!param.start || !!param.end) {
                    select = `select reim.*, req.id as rid, pro.id as pid, pro.title
                            from requestion req right join reimbursement reim on req.id = reim.requestion
                            right join project pro on pro.id = req.project
                            where reim.startDate >= ${param.start} and reim.endDate <=${param.end}
                            order by reim.startDate`
                    result = await querySQL(select)
                    if (!!result.state) {
                        ctx.body = result.body
                    } else {
                        ctx.throw(400, result.msg)
                    }
                } else {
                    ctx.throw(400, 'bad date in param')
                }
                break
            case /\/exportReim/.test(ctx.url):
                if (param.id) {
                    select = [
                        `select r.*, u.name from requestion r join user u on u.id = r.requester where r.id = ${param.id}`,
                        `select * from reimbursement where requestion = ${param.id}`
                    ]
                    result = await querySQL(select)
                    if (!!result.state) {
                        try {
                            let filePath = createPersonReim(result.body[1].body, undefined, result.body[0].body[0])
                            ctx.body = `http://${ctx.host}${filePath}`
                        } catch(e) {
                            ctx.throw(500, 'can not export the .xlsx file')
                        }

                    } else {
                        ctx.throw(400, result[0].msg || result[1].msg)
                    }
                } else {
                    ctx.throw(400, 'bad requestion id in param')
                }
                break
            default:
                ctx.throw(400, 'Not Found')
        }
    }
})

app.use(static(__dirname, 'static'))

app.listen(3000)

// 执行查询函数
function querySQL(select) {
    if (!Array.isArray(select)) {
        return new Promise((res, rej) => {
            connection.query(select, function(error, results, fields) {
                if (error) {
                    rej({
                        state: 0,
                        msg: error
                    })
                } else {
                    res({
                        state: 1,
                        body: results
                    })
                }
            })
        })
    } else {
        return new Promise((resolve, rej) => {
            let results = []
            connection.beginTransaction(function(err) {
                if (err) {
                    rej({
                        state: 0,
                        msg: err
                    })
                }
                select.map((item) => {
                    querySQL(item)
                        .then((res) => {
                            results.push(res)
                            if (results.length === select.length) {
                                connection.commit(function(err) {
                                    if (err) {
                                        connection.rollback(function() {
                                            rej({
                                                state: 0,
                                                msg: err
                                            })
                                        });
                                    }
                                    resolve({
                                        state: 1,
                                        body: results
                                    })
                                });
                            }
                        }, (err) => {
                            console.log('running sql error')
                            connection.rollback(function() {
                                rej({
                                    state: 0,
                                    msg: err
                                })
                            })
                        })
                })
            });
        })
    }
}
