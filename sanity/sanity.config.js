import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'
import { Logo } from './components/logo.tsx'

export default defineConfig({
  name: 'default',
  title: 'The Maroon Ink',

  projectId: 'w7ogeebt',
  dataset: 'production',

  icon: Logo,

  plugins: [structureTool(), visionTool()],

  schema: {
    types: schemaTypes
  }
})
