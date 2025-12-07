import serverless from 'serverless-http';
import {app} from '../init.js';

// export default serverless(app);

export const handler = serverless(app);
