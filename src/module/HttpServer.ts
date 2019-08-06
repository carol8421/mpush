/**
 * HTTP Server
 * create 2019/7/31
 * 负责建立HTTP服务器，接收并处理curl请求
 * 自带异常请求过滤
 * 生成Message对象交由回调函数处理
 */

import http from 'http'
import { parse } from 'url'
import querystring from 'querystring';

import Message from '../model/Message'

interface RequestCallback {
    (message: Message): Promise<{ status: number, responseBody: string }>
}

class HttpError extends Error {
    public status: number
    public HttpErrorMsg: string
    constructor(status: number, HttpErrorMsg: string) {
        super(HttpErrorMsg)
        this.HttpErrorMsg = HttpErrorMsg || ''
        this.status = status || 404
    }
}

export default class HttpServer {
    constructor(port: number, callback: RequestCallback) {
        http.createServer(async (request, response) => {
            try {
                let { status = 200, responseBody = '' } = await callback(await this.verifyRequest(request))
                response.writeHead(status);
                response.end(responseBody)
            } catch (e) {
                response.writeHead(e.status);
                response.end(e.HttpErrorMsg)
            }

        }).listen(port);
    }
    private bodyparser(headers: http.IncomingHttpHeaders, raw: string): { text?: string, desp?: string } {
        let result = {}
        let contentType = headers['content-type']
        try {
            if (/www-form-urlencoded/.test(<string>contentType)) {
                result = querystring.parse(raw)
            } else if (/json/.test(<string>contentType)) {
                result = JSON.parse(raw)
            } else {
                throw new HttpError(415, "Unsupported Media Type")
            }
        } catch (e) {
            throw new HttpError(415, "Unsupported Media Type")
        }
        return result
    }
    private async verifyRequest(request: http.IncomingMessage): Promise<Message> {
        const { pathname, query } = parse(<string>request.url, true)
        const message = new Message()
        if (/^\/[0-9a-zA-Z_-]+\.(send|group)$/.test(<string>pathname)) {
            let path = (<string>pathname).slice(1);
            message.target = path.split(".")[0]
            message.sendType = path.split(".")[1] === 'send' ? 'personal' : 'group'
        } else {
            throw new HttpError(400, "Request Path Invalid Format")
        }

        if (request.method !== 'GET' && request.method !== 'POST') {
            throw new HttpError(405, "Method Not Allowed, Only Allow GET Or POST")
        }

        if (request.method === 'GET') {
            if (typeof query.text === 'string') {
                message.text = decodeURI(<string>query.text)
            } else {
                if (query.text) {
                    throw new HttpError(400, "Text Is Not A String")
                }
            }
            if (typeof query.desp === 'string') {
                message.desp = decodeURI(<string>query.desp)
            } else {
                if (query.desp) {
                    throw new HttpError(400, "Desp Is Not A String")
                }
            }
        } else if (request.method === 'POST') {
            let raw: string = await new Promise((resolve) => {
                let raw = ""
                request.on("data", function (chunk) {
                    raw += chunk
                })
                request.on("end", function () {
                    resolve(raw)
                })
            })
            const body = this.bodyparser(request.headers, raw)
            if (typeof body.text === 'string') {
                message.text = decodeURI(<string>body.text)
            } else {
                if (body.text) {
                    throw new HttpError(400, "Text Is Not A String")
                }
            }
            if (typeof body.desp === 'string') {
                message.desp = decodeURI(<string>body.desp)
            } else {
                if (body.desp) {
                    throw new HttpError(400, "Desp Is Not A String")
                }
            }
        }

        if (!message.verify()) {
            throw new HttpError(400, "Text And Desp Not Found")
        }

        return message
    }
}