import { defineField, defineType } from "sanity";
import { CleanTitleInput } from "../components/CleanTitleInput.jsx";

export const article = defineType({
    name: 'article',
    title: 'Article',
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
            name: 'linkName',
            type: 'slug',
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
            name: 'inkersOnDuty',
            type: 'array',
            of: [{
                type: 'reference',
                to: [{type: 'inker'}]
            }],
            validation: Rule => Rule.unique()
        }),

        defineField({
            name: 'image',
            type: 'image',
            options: {
                hotspot: true,
            },
        }),

        defineField({
            name: 'body',
            type: 'array',
            of: [
                {type: 'block'},
                {type: 'image'}
            ],
        }),
    ],
})