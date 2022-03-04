// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

#include <node.h>
// include the header file generated from the Go build
#include "../lib/liblicensor.h"

using v8::Number;
using v8::FunctionCallbackInfo;
using v8::Isolate;
using v8::Context;
using v8::Local;
using v8::Object;
using v8::Value;
using v8::Exception;
using v8::String;
using v8::Boolean;
using v8::NewStringType;
using v8::PropertyAttribute;

// Extracts a C string from a V8 Utf8Value.
const char* ToCString(const v8::String::Utf8Value& value) {
  return *value ? *value : "<string conversion failed>";
}

void InitM(const FunctionCallbackInfo<Value> &args) {
    Isolate *isolate = args.GetIsolate();

    if (args.Length() < 2) {
        isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "wrong number of arguments").ToLocalChecked()));
        return;
    }

    if (!args[0]->IsString()) {
        isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "argument 0 must be a string").ToLocalChecked()));
        return;
    }
    if (!args[1]->IsString() || args[1]->IsUndefined() || args[1]->IsNull()) {
        isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "argument 1 must be a string").ToLocalChecked()));
        return;
    }

    String::Utf8Value nkey(args.GetIsolate(), args[0]);
    const char* ckey = ToCString(nkey);
    char* key = const_cast<char *>(ckey);

    String::Utf8Value ndomain(args.GetIsolate(), args[1]);
    if (ndomain.length() == 0) {
        isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "domain must not be empty").ToLocalChecked()));
        return;
    }
    const char* cdomain = ToCString(ndomain);
    char* domain = const_cast<char *>(cdomain);

    // Call exported Go function, which returns a C string
    GoInt id = Init(key, domain);

    // return the value
    args.GetReturnValue().Set(Number::New(isolate, id));
}

void ValidateM(const FunctionCallbackInfo<Value> &args) {
    Isolate *isolate = args.GetIsolate();
    Local<Context> context = isolate->GetCurrentContext();

    if (args.Length() < 1) {
        isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "wrong number of arguments").ToLocalChecked()));
        return;
    }
    if (!args[0]->IsNumber() || args[0]->IsUndefined()) {
        isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "argument 0 must be a number").ToLocalChecked()));
        return;
    }

    double rid = args[0]->NumberValue(context).FromMaybe(0);
    int id = static_cast<int>(rid);

    Validate_return r = Validate(id);

    Local<Object> obj = Object::New(isolate);
    obj->Set(context,
        String::NewFromUtf8(isolate, "valid", NewStringType::kNormal).ToLocalChecked(),
        Boolean::New(isolate, r.r1)
    ).FromJust();
    obj->Set(context,
        String::NewFromUtf8(isolate, "msg", NewStringType::kNormal).ToLocalChecked(),
        String::NewFromUtf8(isolate, r.r0).ToLocalChecked()
    ).FromJust();

    args.GetReturnValue().Set(obj);
}

void EnabledM(const FunctionCallbackInfo<Value> &args) {
    Isolate *isolate = args.GetIsolate();
    Local<Context> context = isolate->GetCurrentContext();

    if (args.Length() < 3) {
        isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "wrong number of arguments").ToLocalChecked()));
        return;
    }

    if (!args[0]->IsNumber() || args[0]->IsUndefined()) {
        isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "argument 0 must be a number").ToLocalChecked()));
        return;
    }
    if (!args[1]->IsString() || args[1]->IsUndefined()) {
        isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "argument 1 must be a string").ToLocalChecked()));
        return;
    }
    if (!args[2]->IsNumber() || args[2]->IsUndefined()) {
        isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "argument 2 must be a number").ToLocalChecked()));
        return;
    }

    double rid = args[0]->NumberValue(context).FromMaybe(0);
    int id = static_cast<int>(rid);

    String::Utf8Value str(args.GetIsolate(), args[1]);
    const char* cstr = ToCString(str);
    char* featurestr = const_cast<char *>(cstr);

    double rseats = args[2]->NumberValue(context).FromMaybe(-1);
    int seats = static_cast<int>(rseats);
    if (seats < 0) {
        isolate->ThrowException(Exception::Error(String::NewFromUtf8(isolate, "cannot convert number of seats").ToLocalChecked()));
        return;
    }

    // Call exported Go function, which returns a C string
    Enabled_return r = Enabled(id, featurestr, seats);

    if (!r.r1) {
        isolate->ThrowException(Exception::Error(String::NewFromUtf8(isolate, "invalid instance ID").ToLocalChecked()));
        return;
    }

    // return the value
    args.GetReturnValue().Set(Boolean::New(isolate, r.r0));
}

void HasEnoughSeatsM(const FunctionCallbackInfo<Value> &args) {
    Isolate *isolate = args.GetIsolate();
    Local<Context> context = isolate->GetCurrentContext();

    if (args.Length() < 2) {
        isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "wrong number of arguments").ToLocalChecked()));
        return;
    }
    if (!args[0]->IsNumber() || args[0]->IsUndefined()) {
        isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "argument 0 must be a number").ToLocalChecked()));
        return;
    }
    if (!args[1]->IsNumber() || args[1]->IsUndefined()) {
        isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "argument 1 must be a number").ToLocalChecked()));
        return;
    }

    double rid = args[0]->NumberValue(context).FromMaybe(0);
    int id = static_cast<int>(rid);
    double rseats = args[1]->NumberValue(context).FromMaybe(-1);
    int seats = static_cast<int>(rseats);
    if (seats < 0) {
        isolate->ThrowException(Exception::Error(String::NewFromUtf8(isolate, "cannot convert number of seats").ToLocalChecked()));
        return;
    }

    HasEnoughSeats_return r = HasEnoughSeats(id, seats);

    if (!r.r1) {
        isolate->ThrowException(Exception::Error(String::NewFromUtf8(isolate, "invalid instance ID").ToLocalChecked()));
        return;
    }

    // return the value
    args.GetReturnValue().Set(Boolean::New(isolate, r.r0));
}

void InspectM(const FunctionCallbackInfo<Value> &args) {
    Isolate *isolate = args.GetIsolate();
    Local<Context> context = isolate->GetCurrentContext();

    if (args.Length() < 1) {
        isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "wrong number of arguments").ToLocalChecked()));
        return;
    }
    if (!args[0]->IsNumber() || args[0]->IsUndefined()) {
        isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "argument 0 must be a number").ToLocalChecked()));
        return;
    }

    double rid = args[0]->NumberValue(context).FromMaybe(0);
    int id = static_cast<int>(rid);

    Inspect_return r = Inspect(id);
    if (!r.r1) {
        isolate->ThrowException(Exception::Error(String::NewFromUtf8(isolate, "invalid instance ID").ToLocalChecked()));
        return;
    }

    args.GetReturnValue().Set(String::NewFromUtf8(isolate, r.r0).ToLocalChecked());
}

void DisposeM(const FunctionCallbackInfo<Value> &args) {
    Isolate *isolate = args.GetIsolate();
    Local<Context> context = isolate->GetCurrentContext();

    if (args.Length() < 1) {
        isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "wrong number of arguments").ToLocalChecked()));
        return;
    }
    if (!args[0]->IsNumber() || args[0]->IsUndefined()) {
        isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "argument 0 must be a number").ToLocalChecked()));
        return;
    }

    double rid = args[0]->NumberValue(context).FromMaybe(0);
    int id = static_cast<int>(rid);

    Dispose(id);
}

// add method to exports
void initModule(Local<Object> exports) {
    NODE_SET_METHOD(exports, "init", InitM);
    NODE_SET_METHOD(exports, "validate", ValidateM);
    NODE_SET_METHOD(exports, "isEnabled", EnabledM);
    NODE_SET_METHOD(exports, "hasEnoughSeats", HasEnoughSeatsM);
    NODE_SET_METHOD(exports, "inspect", InspectM);
    NODE_SET_METHOD(exports, "dispose", DisposeM);
}

// create module
NODE_MODULE(licensor, initModule)