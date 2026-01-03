import { defineField, defineType } from "sanity";
import { CleanTitleInput } from "../components/CleanTitleInput.jsx";

export const publishedPaper = defineType({
    name: 'publishedPaper',
    title: 'Published Papers',
    type: 'document',
    fields: [
        defineField({
            name: 'title',
            type: 'string',
            components: {
                input: CleanTitleInput
            },
            validation: (rule) => rule.required(),
        }),

        defineField({
            name: 'subtitle',
            type: 'string',
            placeholder: 'Text below the title. It is optional though',
            components: {
                input: CleanTitleInput
            }
        }),
        
        defineField({
            name: 'linkName',
            type: 'slug',
            placeholder: 'Just click the generate button (works if there is a title)',
            options: {source: 'title'},
            validation: (rule) => rule.required(),
        }),
        
        defineField({
            name: 'publishedAt',
            type: 'datetime',
            initialValue: () => new Date().toISOString(),
            validation: (rule) => rule.required(),
        }),

        defineField({
            name: 'pages',
            type: 'array',
            of: [{
                type: 'image'
            }]
        })
    ]
})