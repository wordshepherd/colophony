import {
  ColophonyPlugin,
  type PluginManifest,
  type PluginRegisterContext,
} from '@colophony/plugin-sdk';

export class BuiltInExtensionsPlugin extends ColophonyPlugin {
  readonly manifest: PluginManifest = {
    id: 'colophony-built-in-extensions',
    name: 'Built-in Extensions',
    version: '1.0.0',
    colophonyVersion: '2.0.0',
    description: 'Demo UI extensions bundled with Colophony',
    author: 'Colophony',
    license: 'MIT',
    category: 'integration',
  };

  async register(ctx: PluginRegisterContext): Promise<void> {
    ctx.registerUIExtension({
      point: 'dashboard.widget',
      id: 'colophony-word-count-widget',
      label: 'Word Count Stats',
      icon: 'BarChart3',
      component: 'colophony.word-count-widget',
      order: 100,
    });
  }
}
