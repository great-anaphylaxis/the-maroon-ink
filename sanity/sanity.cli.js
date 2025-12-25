import {defineCliConfig} from 'sanity/cli'


export default defineCliConfig({
  api: {
    projectId: 'w7ogeebt',
    dataset: 'production'
  },
  deployment: {
    /**
     * Enable auto-updates for studios.
     * Learn more at https://www.sanity.io/docs/cli#auto-updates
     */
    autoUpdates: true,

    appId: 'tqg4w1y51cek9gm7jfh82dk4',
  }
})
