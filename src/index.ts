const PORT = 2222;

import { Request, Response } from 'express';

const path = require('node:path');

require('dotenv').config();
const app = require('express')();

app.get('/', async (req: Request, res: Response) => {
    const fn = require('./handler');
    const fnRes = await fn.handler({ queryStringParameters: req.query }, { token: { access_token: 't1.9euelZqRlpCcms_Nz5jIyMqRnYmSk-3rnpWakJ6eio6Jz8aXnpTMl5iSxsbl8_cANRc--e80bDUY_t3z90BjFD757zRsNRj-zef1656Vmomemo-SmpGQyZ6dj86QmpbL7_zF656Vmomemo-SmpGQyZ6dj86QmpbLveuelZqYnMaczpWTiY_Lx5Gbx56Wi7XrnpWal5may86Xl5OWjsuRxsyOzpg.POi9lwWQ7rV3QAq1zUmnlAyxAdhsFpGEHT8V0WiL10ocgu2YfU_GZn7Pc5zgBqp2hIfasvc8jvBjnobg2xhlCA' } });
    res
        .status(fnRes.statusCode)
        .set(fnRes.headers)
        .send(fnRes.body)
});

app.listen(PORT, () => { console.log(`Server started http://localhost:${PORT}`) });