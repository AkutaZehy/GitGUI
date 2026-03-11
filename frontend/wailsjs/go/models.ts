export namespace git {
	
	export class Branch {
	    Name: string;
	    IsHead: boolean;
	    IsRemote: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Branch(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Name = source["Name"];
	        this.IsHead = source["IsHead"];
	        this.IsRemote = source["IsRemote"];
	    }
	}
	export class Commit {
	    Hash: string;
	    Message: string;
	    Author: string;
	    Date: string;
	
	    static createFrom(source: any = {}) {
	        return new Commit(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Hash = source["Hash"];
	        this.Message = source["Message"];
	        this.Author = source["Author"];
	        this.Date = source["Date"];
	    }
	}
	export class FileStatus {
	    Path: string;
	    Status: string;
	    IsStaged: boolean;
	    IsUntracked: boolean;
	
	    static createFrom(source: any = {}) {
	        return new FileStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Path = source["Path"];
	        this.Status = source["Status"];
	        this.IsStaged = source["IsStaged"];
	        this.IsUntracked = source["IsUntracked"];
	    }
	}

}

