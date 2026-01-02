import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'
import { Logo } from './components/Logo.tsx'
import { 
  CalendarIcon, 
  ErrorOutlineIcon, 
  CogIcon,         
  SearchIcon,
  DocumentsIcon
} from '@sanity/icons'

export default defineConfig({
    name: 'default',
    title: 'The Maroon Ink',

    projectId: 'w7ogeebt',
    dataset: 'production',

    icon: Logo,

    plugins: [
        structureTool({
        name: 'theMaroonInk',
        title: 'The Maroon Ink Website',
        icon: Logo,
        structure: (S, context) => {
            
            // Dynamic Month Logic: This builds the list of available months
            const getDynamicDateItems = async () => {
            const client = context.getClient({ apiVersion: '2023-01-01' });
            const query = `*[_type == "article" && defined(publishedAt)] | order(publishedAt desc).publishedAt`;
            const dates = await client.fetch(query);
            const yearMonths = [...new Set(dates.map(date => date.slice(0, 7)))];

            return yearMonths.map((ym) => {
                const [year, month] = ym.split('-');
                const monthName = new Date(year, parseInt(month) - 1)
                .toLocaleString('default', { month: 'long' });

                return S.listItem()
                .title(`${monthName} ${year}`)
                .icon(CalendarIcon)
                .child(
                    S.documentList()
                    .title(`${monthName} ${year}`)
                    .schemaType('article')
                    .defaultLayout('card') // Triggers the grid/card layout
                    .filter('_type == "article" && publishedAt match $yearMonth')
                    .params({ yearMonth: `${ym}*` })
                );
            });
            };

            return S.list()
            .title('Content')
            .items([
                // 1. Settings (Singleton)
                S.listItem()
                .title('Website Settings')
                .id('websiteSettings')
                .icon(CogIcon)
                .child(
                    S.document()
                    .schemaType('websiteSettings')
                    .documentId('websiteSettings')
                ),

                S.divider(),

                // 2. Master Archive (The "All Articles" view)
                S.listItem()
                .title('All Articles (Master List)')
                .icon(SearchIcon)
                .child(
                    S.documentList()
                    .title('Master Archive')
                    .schemaType('article')
                    .defaultLayout('card') // Triggers the grid/card layout
                    .filter('_type == "article"')
                    .defaultOrdering([{ field: 'publishedAt', direction: 'desc' }])
                ),

                // 3. Browse by Month (Sub-list to save root sidebar space)
                S.listItem()
                .title('Browse by Month')
                .icon(DocumentsIcon)
                .child(async () => 
                    S.list()
                    .title('Select Month')
                    .items(await getDynamicDateItems())
                ),

                // 4. Safety Net (For articles missing dates)
                S.listItem()
                .title('Undated Articles')
                .icon(ErrorOutlineIcon) 
                .child(
                    S.documentList()
                    .title('Missing Published Date')
                    .schemaType('article')
                    .defaultLayout('card') // Triggers the grid/card layout
                    .filter('_type == "article" && !defined(publishedAt)')
                ),

                S.divider(),

                // 5. Automatic list for all other types (Authors, Categories, etc.)
                ...S.documentTypeListItems().filter(
                (listItem) => !['websiteSettings', 'article'].includes(listItem.getId())
                ),
            ]);
        },
        }),
        visionTool({
            name: 'visionTool',
            title: 'For Developers Only',
        }),
    ],

    schema: {
        types: schemaTypes
    }
})
