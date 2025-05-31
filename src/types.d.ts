// Github GraphQL Repository structure
export type Repository = {
    stargazerCount: number;
    forkCount: number;
    languages: {
        edges: {
            size: number;
            node: {
                name: string;
                color: string;
            };
        }[];
    };
};

// data, passed to .pug file
export interface Essentials {
    langs: {
        [language: string]: {
            size: number;
            color: string;
            sizep: string;
        }
    };
    total: {
        langSize: number;
        stars: number;
        forks: number;
    }
}