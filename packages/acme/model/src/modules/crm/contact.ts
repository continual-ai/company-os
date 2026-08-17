import { defineObject, email, link, phone, text } from "@continual/model"

import { Customer } from "./customer"

export const Contact = defineObject({
  id: "contact",
  name: "Contact",
  pluralName: "Contacts",
  description: "A person associated with a customer organization.",
  fields: {
    customerId: link({ object: Customer, required: true }),
    firstName: text({ required: true }),
    lastName: text({ required: true }),
    title: text(),
    email: email({ required: true }),
    phone: phone(),
  },
  display: {
    title: "lastName",
    subtitle: "email",
  },
})
