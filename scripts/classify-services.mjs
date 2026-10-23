// Categories are assigned by the AI host through the skill workflow.
// Scanning only carries saved assignments forward; it never calls a model API.
export const serviceGroups = ['infrastructure', 'integrations', 'developer-tools'];

export function classifyServices(services, { previous = [] } = {}) {
  const prior = new Map(previous.map(service => [service.id, service]));
  for (const service of services) {
    const groups = prior.get(service.id)?.groups;
    service.groups = [...new Set((Array.isArray(groups) ? groups : [])
      .filter(group => serviceGroups.includes(group)))];
  }
  return services;
}
