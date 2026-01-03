import { defineField, defineType } from "sanity";

export const websiteSettings = defineType({
    name: 'websiteSettings',
    title: 'Website Settings',
    type: 'document',
    fields: [        
        defineField({
            name: 'name',
            type: 'string',
            initialValue: 'Website Settings',
            hidden: true,
        }),

        defineField({
            name: 'featuredArticles',
            type: 'array',
            of: [{
                type: 'reference',
                to: [{type: 'article'}]
            }],
            validation: Rule => Rule.unique()
        })
    ],
})