<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [iceshrimp-js](./iceshrimp-js.md) &gt; [entities](./iceshrimp-js.entities.md) &gt; [MessagingMessage](./iceshrimp-js.entities.messagingmessage.md)

## entities.MessagingMessage type

**Signature:**

```typescript
export declare type MessagingMessage = {
	id: ID;
	createdAt: DateString;
	file: DriveFile | null;
	fileId: DriveFile["id"] | null;
	isRead: boolean;
	reads: User["id"][];
	text: string | null;
	user: User;
	userId: User["id"];
	recipient?: User | null;
	recipientId: User["id"] | null;
	group?: UserGroup | null;
	groupId: UserGroup["id"] | null;
};
```
**References:** [ID](./iceshrimp-js.entities.id.md)<!-- -->, [DateString](./iceshrimp-js.entities.datestring.md)<!-- -->, [DriveFile](./iceshrimp-js.entities.drivefile.md)<!-- -->, [User](./iceshrimp-js.entities.user.md)<!-- -->, [UserGroup](./iceshrimp-js.entities.usergroup.md)

