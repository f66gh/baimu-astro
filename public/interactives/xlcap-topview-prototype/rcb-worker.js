import { partitionWithTrace } from './rcb-trace.js';
import { expandEnvironment } from './environment.js';

self.onmessage = ({ data: { layout, config, label } }) => {
  try {
    const output = partitionWithTrace(layout, config);
    try {
      output.environment = expandEnvironment(layout, label, output.result);
    } catch (error) {
      // Missing/invalid electrical labels do not prevent geometry partitioning.
      output.environmentError = error.message || '无法计算环境外扩范围。';
    }
    self.postMessage(output);
  } catch (error) {
    self.postMessage({ error: error.message || 'RCB 切分失败。' });
  }
};
