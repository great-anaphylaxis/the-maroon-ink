import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'
import { Logo } from './components/Logo.tsx'

export default defineConfig({
    name: 'default',
    title: 'The Maroon Ink',

    projectId: 'w7ogeebt',
    dataset: 'production',

    icon: Logo,

    plugins: [structureTool({
        name: 'theMaroonInk',
        title: 'The Maroon Ink Website',
        icon: Logo,
        structure: (S) =>
        S.list()
          .title('Content')
          .items([
            S.listItem()
              .title('Website Settings')
              .id('websiteSettings')
              .child(
                S.document()
                  .schemaType('websiteSettings')
                  .documentId('websiteSettings')
              ),

            ...S.documentTypeListItems().filter(
              (listItem) => !['websiteSettings'].includes(listItem.getId())
            ),
          ]),
    }), visionTool({
        name: 'visionTool',
        title: 'For Developers Only'
    })],

    schema: {
        types: schemaTypes
    }
})
