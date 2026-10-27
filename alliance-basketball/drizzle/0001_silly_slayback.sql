CREATE TABLE `workspace_chunks` (
	`snapshot` text NOT NULL,
	`part` integer NOT NULL,
	`content` text NOT NULL,
	PRIMARY KEY(`snapshot`, `part`)
);
