import { getPersonalNotifications } from './alert-service';
import { getRefusalNotifications } from './assignment-refusals';

export async function getBellNotifications(client, publisherId, today, options = {}) {
  const refusals = await getRefusalNotifications(client, publisherId, { today, versions: options.versions });
  return getPersonalNotifications(client, publisherId, today, { ...options, refusals });
}
