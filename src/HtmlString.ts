export class HtmlString {
	constructor(public value: string) {}
	push(other: HtmlString) {
		this.value = `${this.value}\n${other.value}`;
	}
}
