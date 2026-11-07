// Deliberately exclude exception messages: they can contain URIs or document values.
export function startupError(error, stage) {
  const code = error.code || error.cause?.code;
  let guidance = 'Check database connectivity and permissions.';
  if (code === 'TRANSACTIONS_UNAVAILABLE') guidance = 'Use Atlas or a MongoDB replica set; standalone MongoDB cannot run hotel transactions.';
  else if (code === 18 || code === 'AuthenticationFailed') guidance = 'Database authentication failed. Verify the Atlas database user and password in server/.env.';
  else if (code === 13) guidance = 'Database access denied. Verify the database user has the required database and index permissions.';
  else if (code === 11000) guidance = 'Duplicate records prevent a unique index. Review the affected collection; do not delete data or indexes blindly.';
  else if ([85, 86].includes(code)) guidance = 'An existing index conflicts with the model definition. Review index definitions before performing a migration.';
  else if (['ENOTFOUND', 'ESERVFAIL', 'ETIMEOUT', 'ECONNREFUSED'].includes(code)) guidance = 'Database DNS or network connection failed. Check DNS, firewall/VPN and Atlas network access.';
  else if (['MongooseServerSelectionError', 'MongoServerSelectionError'].includes(error.name)) guidance = 'No database server is reachable. Check Atlas cluster availability, the current IP access list, firewall/VPN and TLS connectivity.';
  return `Startup failed during ${stage}. ${guidance}`;
}
