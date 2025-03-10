import { mount, createLocalVue } from '@vue/test-utils';
import { renderToString } from '@vue/server-test-utils';
import { ValidationProvider, ValidationObserver } from '@/index.full';
import flushPromises from 'flush-promises';

const Vue = createLocalVue();
Vue.component('ValidationProvider', ValidationProvider);
Vue.component('ValidationObserver', ValidationObserver);

async function flush() {
  await flushPromises();

  return new Promise(resolve => {
    setTimeout(resolve, 50);
  });
}

const DEFAULT_REQUIRED_MESSAGE = 'The {field} field is required';

test('renders the slot', () => {
  const wrapper = mount(
    {
      template: `
      <ValidationObserver tag="form" v-slot="ctx">
      </ValidationObserver>
    `
    },
    { localVue: Vue, sync: false }
  );

  expect(wrapper.html()).toBe(`<form></form>`);
});

test('renders the scoped slot in SSR', () => {
  const output = renderToString(
    {
      template: `
      <ValidationObserver tag="form" v-slot="ctx">
      </ValidationObserver>
    `
    },
    { localVue: Vue, sync: false }
  );

  expect(output).toBe(`<form data-server-rendered="true"></form>`);
});

test('renders the default slot if no scoped slots in SSR', () => {
  const output = renderToString(
    {
      template: `
      <ValidationObserver tag="form">
      </ValidationObserver>
    `
    },
    { localVue: Vue, sync: false }
  );

  expect(output).toBe(`<form data-server-rendered="true"></form>`);
});

test('observes the current state of providers', async () => {
  const wrapper = mount(
    {
      data: () => ({
        value: ''
      }),
      template: `
      <ValidationObserver v-slot="{ valid }">
        <ValidationProvider rules="required" v-slot="ctx">
          <input v-model="value" type="text">
        </ValidationProvider>

        <span id="state">{{ valid }}</span>
      </ValidationObserver>
    `
    },
    { localVue: Vue, sync: false }
  );

  const stateSpan = wrapper.find('#state');
  const input = wrapper.find('input');

  await flush();
  // initially the field valid flag is false.
  expect(stateSpan.text()).toBe('false');

  input.setValue('value');
  await flush();

  expect(stateSpan.text()).toBe('true');
});

test('triggers validation manually on its children providers using refs', async () => {
  const wrapper = mount(
    {
      data: () => ({
        value: ''
      }),
      template: `
      <ValidationObserver ref="obs" v-slot="ctx">
        <ValidationProvider rules="required" v-slot="{ errors }">
          <input v-model="value" type="text">
          <span id="error">{{ errors[0] }}</span>
        </ValidationProvider>
      </ValidationObserver>
    `
    },
    { localVue: Vue, sync: false }
  );

  const error = wrapper.find('#error');
  await flush();
  expect(error.text()).toBe('');

  await wrapper.vm.$refs.obs.validate();
  await flush();

  expect(error.text()).toBe(DEFAULT_REQUIRED_MESSAGE);
});

test('passes only executes the callback if observer is valid', async () => {
  const wrapper = mount(
    {
      data: () => ({
        value: '',
        calls: 0
      }),
      methods: {
        submit() {
          this.calls++;
        }
      },
      template: `
      <ValidationObserver v-slot="ctx">
        <ValidationProvider rules="required" v-slot="{ errors }">
          <input v-model="value" type="text">
          <span id="error">{{ errors[0] }}</span>
        </ValidationProvider>
        <button @click="ctx.handleSubmit(submit)">Validate</button>
      </ValidationObserver>
    `
    },
    { localVue: Vue, sync: false }
  );

  const error = wrapper.find('#error');
  const input = wrapper.find('input');
  await flush();
  expect(error.text()).toBe('');

  wrapper.find('button').trigger('click');
  await flush();
  expect(wrapper.vm.calls).toBe(0);

  expect(error.text()).toBe(DEFAULT_REQUIRED_MESSAGE);
  input.setValue('12');
  wrapper.find('button').trigger('click');
  await flush();

  expect(error.text()).toBe('');
  expect(wrapper.vm.calls).toBe(1);
});

test('removes child ref when the child is destroyed', async () => {
  const wrapper = mount(
    {
      data: () => ({
        value: ''
      }),
      template: `
      <ValidationObserver ref="obs" v-slot="ctx">
        <ValidationProvider rules="required" vid="id" v-slot="{ errors }">
          <input v-model="value" type="text">
          <span id="error">{{ errors[0] }}</span>
        </ValidationProvider>
      </ValidationObserver>
    `
    },
    { localVue: Vue, sync: false }
  );

  const obs = wrapper.vm.$refs.obs;
  expect(obs.refs).toHaveProperty('id');

  wrapper.destroy();

  expect(obs.refs).not.toHaveProperty('id');
});

test('resets child refs', async () => {
  const wrapper = mount(
    {
      data: () => ({
        value: ''
      }),
      template: `
      <ValidationObserver ref="obs" v-slot="ctx">
        <ValidationProvider rules="required" v-slot="{ errors }">
          <input v-model="value" type="text">
          <span id="error">{{ errors[0] }}</span>
        </ValidationProvider>
      </ValidationObserver>
    `
    },
    { localVue: Vue, sync: false }
  );

  const error = wrapper.find('#error');
  await flush();
  expect(error.text()).toBe('');

  await wrapper.vm.$refs.obs.validate();

  expect(error.text()).toBe(DEFAULT_REQUIRED_MESSAGE);

  wrapper.vm.$refs.obs.reset();
  await flush();

  expect(error.text()).toBe('');
});

test('resets child refs using reset on the v-slot data', async () => {
  const wrapper = mount(
    {
      data: () => ({
        value: ''
      }),
      template: `
      <ValidationObserver ref="obs" v-slot="ctx">
        <ValidationProvider rules="required" v-slot="{ errors }">
          <input v-model="value" type="text">
          <span id="error">{{ errors[0] }}</span>
        </ValidationProvider>
        <button @click="ctx.reset()">Reset</button>
      </ValidationObserver>
    `
    },
    { localVue: Vue, sync: false }
  );

  const error = wrapper.find('#error');
  await flush();
  expect(error.text()).toBe('');

  wrapper.vm.$refs.obs.validate();
  await flush();

  expect(error.text()).toBe(DEFAULT_REQUIRED_MESSAGE);

  await wrapper.find('button').trigger('click');
  await flush();

  expect(error.text()).toBe('');
});

test('resets inactive refs that were cached', async () => {
  const wrapper = mount(
    {
      data: () => ({
        value: '',
        shown: true
      }),
      template: `
      <ValidationObserver ref="obs" v-slot="ctx">
        <ValidationProvider rules="required" v-slot="{ errors }" name="provider" persist v-if="shown">
          <input v-model="value" type="text">
          <span id="error">{{ errors[0] }}</span>
        </ValidationProvider>
      </ValidationObserver>
    `
    },
    { localVue: Vue, sync: false }
  );

  let error = wrapper.find('#error');
  await flush();
  expect(error.text()).toBe('');

  await wrapper.vm.$refs.obs.validate();

  expect(error.text()).toContain('The provider field is required');
  wrapper.setData({
    shown: false
  });
  wrapper.vm.$refs.obs.reset();
  wrapper.setData({
    shown: true
  });
  await flush();
  error = wrapper.find('#error');

  expect(error.text()).toBe('');
});

test('collects errors from child providers', async () => {
  const wrapper = mount(
    {
      data: () => ({
        email: '',
        name: ''
      }),
      template: `
      <ValidationObserver ref="obs" v-slot="{ errors }">
        <ValidationProvider vid="name" rules="required" v-slot="ctx">
          <input v-model="name" type="text">
        </ValidationProvider>
        <ValidationProvider vid="email" rules="required" v-slot="ctx">
          <input v-model="email" type="text">
        </ValidationProvider>
        <p v-for="fieldErrors in errors">{{ fieldErrors[0] }}</p>
      </ValidationObserver>
    `
    },
    { localVue: Vue, sync: false }
  );

  await flush();

  await wrapper.vm.$refs.obs.validate();
  await flush();

  const errors = wrapper.findAll('p');
  expect(errors).toHaveLength(2); // 2 fields.
  expect(errors.at(0).text()).toBe(DEFAULT_REQUIRED_MESSAGE);
  expect(errors.at(1).text()).toBe(DEFAULT_REQUIRED_MESSAGE);
});

test('exposes nested observers state', async () => {
  const wrapper = mount(
    {
      data: () => ({
        name: ''
      }),
      template: `
      <ValidationObserver ref="obs" v-slot="state">
        <ValidationObserver>
          <ValidationProvider vid="name" rules="required|alpha" v-slot="_">
            <input v-model="name" type="text">
          </ValidationProvider>
        </ValidationObserver>
        <p>{{ state.errors }}</p>
      </ValidationObserver>
    `
    },
    { localVue: Vue, sync: false }
  );

  await flush();
  const input = wrapper.find('input');
  input.setValue('1');
  await flush();

  expect(wrapper.find('p').text()).toContain('The {field} field may only contain alphabetic characters');
});

test('validates and resets nested observers', async () => {
  const wrapper = mount(
    {
      data: () => ({
        name: ''
      }),
      template: `
      <ValidationObserver ref="obs" v-slot="state">
        <ValidationObserver>
          <ValidationProvider vid="name" rules="required|alpha" v-slot="_">
            <input v-model="name" type="text">
          </ValidationProvider>
        </ValidationObserver>
        <p>{{ state.errors }}</p>
      </ValidationObserver>
    `
    },
    { localVue: Vue, sync: false }
  );

  await flush();
  expect(wrapper.find('p').text()).not.toContain(DEFAULT_REQUIRED_MESSAGE);
  await wrapper.vm.$refs.obs.validate();
  await flush();
  expect(wrapper.find('p').text()).toContain(DEFAULT_REQUIRED_MESSAGE);
  await wrapper.vm.$refs.obs.reset();
  await flush();
  expect(wrapper.find('p').text()).not.toContain(DEFAULT_REQUIRED_MESSAGE);
});

test('handles unmouting nested observers', async () => {
  const wrapper = mount(
    {
      data: () => ({
        name: '',
        isMounted: true
      }),
      template: `
      <ValidationObserver ref="obs" v-slot="state">
        <ValidationObserver v-if="isMounted" vid="NESTED_OBS">
          <ValidationProvider vid="name" rules="required|alpha" v-slot="_">
            <input v-model="name" type="text">
          </ValidationProvider>
        </ValidationObserver>
        <p>{{ state.errors }}</p>
      </ValidationObserver>
    `
    },
    { localVue: Vue, sync: false }
  );

  await flush();
  expect(wrapper.find('p').text()).toContain(`NESTED_OBS`); // observer is mounted.
  wrapper.setData({
    isMounted: false
  });
  await flush();
  expect(wrapper.find('p').text()).not.toContain(`NESTED_OBS`); // observer is mounted.
});

test('persist provider state after destroyed', async () => {
  const wrapper = mount(
    {
      data: () => ({
        value: '',
        isHidden: false
      }),
      template: `
    <div>
      <ValidationObserver>
        <div v-if="!isHidden">
          <ValidationProvider
            rules="required|min:3|max:6"
            vid="myfield"
            v-slot="{ errors }"
            :persist="true"
          >
            <input type="text" v-model="value">
            <span>{{ errors[0] }}</span>
          </ValidationProvider>
        </div>
      </ValidationObserver>
      <button @click="isHidden = !isHidden">Toggle</button>
    </div>
    `
    },
    { localVue: Vue }
  );

  const button = wrapper.find('button');
  const input = wrapper.find('input');
  await flush();
  input.element.value = 'se';
  input.trigger('input');
  await flush();

  button.trigger('click');
  await flush();
  button.trigger('click');
  await flush();
  const span = wrapper.find('span');
  expect(span.text()).toBeTruthy();
});

test('Sets errors for all providers', async () => {
  const wrapper = mount(
    {
      data: () => ({
        field1: '',
        field2: ''
      }),
      template: `
    <div>
      <ValidationObserver ref="observer">
        <ValidationProvider
          vid="field1"
          v-slot="{ errors }"
        >
          <input type="text" v-model="field1">
          <span id="error1">{{ errors[0] }}</span>
        </ValidationProvider>

        <ValidationProvider
          name="field2"
          v-slot="{ errors }"
        >
          <input type="text" v-model="field2">
          <span id="error2">{{ errors[0] }}</span>
        </ValidationProvider>
      </ValidationObserver>
    </div>
    `
    },
    { localVue: Vue }
  );

  await flush();
  expect(wrapper.find('#error1').text()).toBe('');
  expect(wrapper.find('#error2').text()).toBe('');

  wrapper.vm.$refs.observer.setErrors({
    field1: ['wrong'],
    field2: ['whoops']
  });

  await flush();
  expect(wrapper.find('#error1').text()).toBe('wrong');
  expect(wrapper.find('#error2').text()).toBe('whoops');
});

test('Sets errors for nested observer providers', async () => {
  const wrapper = mount(
    {
      data: () => ({
        field1: '',
        field2: ''
      }),
      template: `
    <div>
      <ValidationObserver ref="observer">
        <ValidationObserver>
          <ValidationProvider
            vid="field1"
            v-slot="{ errors }"
          >
            <input type="text" v-model="field1">
            <span id="error1">{{ errors[0] }}</span>
          </ValidationProvider>

          <ValidationProvider
            name="field2"
            v-slot="{ errors }"
          >
            <input type="text" v-model="field2">
            <span id="error2">{{ errors[0] }}</span>
          </ValidationProvider>
        </ValidationObserver>
      </ValidationObserver>
    </div>
    `
    },
    { localVue: Vue }
  );

  await flush();
  expect(wrapper.find('#error1').text()).toBe('');
  expect(wrapper.find('#error2').text()).toBe('');

  wrapper.vm.$refs.observer.setErrors({
    field1: ['wrong'],
    field2: ['whoops']
  });

  await flush();
  expect(wrapper.find('#error1').text()).toBe('wrong');
  expect(wrapper.find('#error2').text()).toBe('whoops');
});
