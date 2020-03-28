const {
    Record,
    StoreOf,
    Component,
    ListOf,
} = window.Torus;

const DATA_ORIGIN = '/data';

const PAGIATE_BY = 20;

const TODAY_ISO = (new Date()).toISOString().slice(0, 10);

class Contact extends Record {

    singleProperties() {
        return [
            ['name', 'name', 'name'],
            ['place', 'place', 'place'],
            ['work', 'work', 'work'],
            ['twttr', 'twttr', '@username'],
            ['last', 'last', 'last met...'],
            ['notes', 'notes', 'notes', true],
        ];
    }

    multiProperties() {
        return [
            ['tel', 'tel', 'tel'],
            ['email', 'email', 'email'],
            ['mtg', 'mtg', 'meeting', true],
        ]
    }

}

class ContactStore extends StoreOf(Contact) {

    init(...args) {
        this.super.init(...args);
    }

    get comparator() {
        return contact => {
            // ? is a special sentinel value that belongs at top of list
            if (contact.get('name') === '?') {
                return -Infinity;
            }

            const last = contact.get('last');
            if (!last) {
                return 0;
            }

            const lastDate = new Date(last);
            return -lastDate.getTime();
        }
    }

    async fetch() {
        const data = await fetch(DATA_ORIGIN).then(resp => resp.json());
        if (!Array.isArray(data)) {
            throw new Error(`Expected data to be an array, got ${data}`);
        }

        this.reset(data.map(rec => new this.recordClass({
            ...rec,
            id: rec.id,
        })));
    }

    async persist() {
        return fetch(DATA_ORIGIN, {
            method: 'POST',
            body: JSON.stringify(this.serialize()),
        });
    }

}

class ContactItem extends Component {

    init(record, remover, {persister, sorter}) {
        this.isEditing = false;

        this.inputs = {};

        this.toggleIsEditing = this.toggleIsEditing.bind(this);
        this.toggleIsEditingSilently = this.toggleIsEditingSilently.bind(this);
        this.handleDeleteClick = this.handleDeleteClick.bind(this);
        this.fillToday = this.fillToday.bind(this);
        this.handleInput = this.handleInput.bind(this);
        this.persistIfEnter = this.persistIfEnter.bind(this);

        this.remover = () => {
            remover();
            persister();
        }
        this.persister = persister;
        this.sorter = sorter;

        this.bind(record, data => this.render(data));
    }

    addMultiItem(label) {
        this.inputs[label] = this.inputs[label].concat('');
        this.render();
    }

    toggleIsEditing(evt) {
        if (evt) {
            evt.stopPropagation();
        }

        if (this.isEditing) {
            this.record.update(this.inputs);
            this.persister();
            this.sorter();
        } else {
            this.inputs = this.record.serialize();
        }

        this.toggleIsEditingSilently();
    }

    toggleIsEditingSilently(evt) {
        if (evt) {
            evt.stopPropagation();
        }

        this.isEditing = !this.isEditing;
        this.render();
    }

    handleDeleteClick(evt) {
        if (window.confirm(`Delete ${this.record.get('name')}?`)) {
            this.remover();
        }
    }

    fillToday(evt) {
        this.node.querySelector('[name=last]').value = TODAY_ISO;
    }

    handleInput(evt) {
        const propIdx = evt.target.getAttribute('name');
        if (propIdx.includes('-')) {
            // multi style prop
            const [prop, idx] = propIdx.split('-');
            this.inputs[prop][idx] = evt.target.value;
        } else {
            // single style prop
            this.inputs[propIdx] = evt.target.value;
        }
        this.render();
    }

    persistIfEnter(evt) {
        if (evt.key === 'Enter' && (evt.ctrlKey || evt.metaKey)) {
            this.toggleIsEditing();
        }
    }

    compose(data) {
        const inputGroup = (label, prop, placeholder, isMultiline = false) => {
            const val = this.isEditing ? this.inputs[prop] : data[prop];

            if (!this.isEditing && !val) {
                return null;
            }

            const tag = isMultiline ? 'textarea' : 'input';

            return jdom`<div class="inputGroup">
                <label class="contact-label">${label}</label>
                <div class="entries">
                    ${this.isEditing ? (
                        jdom`<${tag} type="text" name="${prop}" value="${val}"
                            class="contact-input"
                            autocomplete="none"
                            onkeydown="${this.persistIfEnter}"
                            oninput="${this.handleInput}"
                            placeholder="${placeholder}" />`
                    ) : (
                        jdom`<div>${val}</div>`
                    )}
                </div>
            </div>`;
        }

        const inputMultiGroup = (label, prop, placeholder, isMultiline = false) => {
            const vals = (this.isEditing ? this.inputs[prop] : data[prop]) || [];

            if (!this.isEditing && vals.length === 0) {
                return null;
            }

            const tag = isMultiline ? 'textarea' : 'input';

            return jdom`<div class="inputGroup">
                <label class="contact-label">${label}</label>
                <div class="entries">
                    ${this.isEditing ? (
                        vals.map((t, idx) => jdom`<${tag} type="text" name="${prop}-${idx}" value="${t}"
                                class="contact-input"
                                autocomplete="none"
                                onkeydown="${this.persistIfEnter}"
                                oninput="${this.handleInput}"
                                placeholder="${placeholder}" />`)
                            .concat(jdom`<button class="contact-add-button"
                                onclick="${this.addMultiItem.bind(this, prop)}">+ ${placeholder}</button>`)
                    ) : (
                        vals.map(t => jdom`<span>${t.substr(0, 256)}</span>`)
                    )}
                </div>
            </div>`;
        }

        return jdom`<li class="contact-item card paper block split-v ${this.isEditing ? 'isEditing' : 'notEditing'}"
                onclick="${this.isEditing || this.toggleIsEditing}">
            <div class="editArea split-h">
                <div class="left contact-single-items">
                    ${this.record.singleProperties().map(args => {
                        return inputGroup(...args)
                    })}
                </div>
                <div class="right contact-multi-items">
                    ${this.record.multiProperties().map(args => {
                        return inputMultiGroup(...args)
                    })}
                </div>
            </div>
            ${this.isEditing ? jdom`<div class="buttonFooter split-h frost">
                <div class="left buttonArea">
                    <button class="contact-button" onclick="${this.handleDeleteClick}">delete</button>
                </div>
                <div class="right buttonArea">
                    <button class="contact-button" onclick="${this.fillToday}">today!</button>
                    <button class="contact-button" onclick="${this.toggleIsEditingSilently}">cancel</button>
                    <button class="contact-button" onclick="${this.toggleIsEditing}">save</button>
                </div>
            </div>` : null}
        </li>`;
    }

}

class ContactList extends ListOf(ContactItem) {

    compose(items) {
        return jdom`<ul class="contact-list">
            ${this.nodes.slice(0, PAGIATE_BY)}
        </div>`;
    }

}

class App extends Component {

    init() {
        this.searchInput = '';
        this.isFetching = false;

        this.handleSearch = this.handleSearch.bind(this);

        this.contacts = new ContactStore();
        this.list = new ContactList(
            this.contacts,
            {
                persister: async () => {
                    this.isFetching = true;
                    this.render();

                    await this.contacts.persist();

                    this.isFetching = false;
                    this.render();
                },
                sorter: () => this.list.itemsChanged(),
            },
        );

        (async () => {
            this.isFetching = true;
            this.render();

            await this.contacts.fetch();

            this.isFetching = false;
            this.render();
        })();
    }

    handleSearch(evt) {
        this.searchInput = evt.target.value.trim();

        if (this.searchInput === '') {
            this.list.unfilter();
            return
        }

        const kw = this.searchInput.toLowerCase();
        function matches(s) {
            return s.toString().toLowerCase().includes(kw);
        }

        this.list.filter(contact => {
            for (const v of Object.values(contact.serialize())) {
                if (v == null) {
                    continue;
                }

                if (Array.isArray(v)) {
                    for (const it of v) {
                        if (matches(it)) {
                            return true;
                        }
                    }
                } else {
                    if (matches(v)) {
                        return true;
                    }
                }
            }

            return false;
        });
    }

    compose() {
        return jdom`<div>
            <header>
                <div class="title">
                    <a href="/">mira</a>
                </div>
                <div class="searchBar card">
                    <input type="text" value="${this.searchInput}"
                        class="searchInput paper block"
                        oninput="${this.handleSearch}"
                        placeholder="search ${this.contacts.records.size} contacts ..."
                        autofocus />
                </div>
                <button class="addButton card frost block"
                    onclick="${() => this.contacts.create({
                        name: '?',
                        last: TODAY_ISO,
                    })}">add</button>
            </header>
            ${this.list.node}
            <footer>
                <a href="https://github.com/thesehpist/mira" target="_blank">src</a>
                ::
                &#169; 2020
            </footer>
            ${this.isFetching ? jdom`<div class="loader" />`: null}
        </div>`;
    }

}

const app = new App();
document.getElementById('app').appendChild(app.node);
