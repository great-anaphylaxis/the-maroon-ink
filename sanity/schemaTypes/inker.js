import { defineField, defineType } from "sanity";

export const inker = defineType({
    name: 'inker',
    title: 'Inkers',
    type: 'document',
    fields: [
        defineField({
            name: 'name',
            type: 'string',
            validation: (rule) => rule.required(),
        }),
        
        defineField({
            name: 'username',
            type: 'slug',
            options: {source: 'name'},
            validation: (rule) => rule.required(),
        }),

        defineField({
            name: 'profilePicture',
            type: 'image'
        }),

        defineField({
            name: 'role',
            type: 'string',
        }),

        defineField({
            name: 'bio',
            type: 'string'
        }),
    ],
})